# Infrastructure Assessment: Can Neon + Vercel + Cron Support v2?

> **Date:** 2026-03-18
> **Triggered by:** Researcher question: "whether Neon + Vercel + cron can actually support the full pipeline you committed to"
> **Answer:** Yes, with constraints. The stack handles the v2 design at the target scale (500 users) without migration. Some design features need to be implemented differently than they'd be on custom infra.

---

## Current Stack

- **Neon serverless Postgres** -- Connection pooling, autoscaling, branching. Postgres 15+.
- **Vercel serverless functions** -- Astro SSR via @astrojs/vercel/serverless. Cold starts, 10s default timeout (configurable to 60s on Pro, 300s on Enterprise).
- **Vercel Cron** -- HTTP-triggered cron jobs. Current schedule: auto-publish (15min), push-resets (15min), compute-health (30min), compute-trust (2hr).

## Assessment by v2 Component

### 1. Event Sourcing -- YES, fits naturally

The events table is just an append-only Postgres table. INSERT performance is trivial. The design already specifies "selective" event sourcing -- only material state changes, not routine recomputations.

**Scale math at 500 users:**
- ~50-200 signals/day -> ~200-800 events/day (create, publish, status changes, votes)
- Trust recomputation every 2hr, ~500 users, only logging changes > 0.05 -> maybe 20-50 events per cycle
- Health recomputation every 30min, ~50 casinos -> ~5-10 events per cycle (only status transitions)
- Total: ~300-1000 events/day. Postgres handles this without breaking a sweat.

**Concern:** Event table growth. At 1000/day, that's 365K rows/year. With proper indexing and the tiered archival strategy (partition by month, relax indexes on old partitions), this stays manageable for years.

**Verdict:** No infra change needed.

### 2. Behavioral Telemetry -- YES, with client-side batching

Telemetry events (feed_view, signal_expand, casino_track) could be high-volume if emitted per-interaction. At 500 daily active users with 10 events each, that's 5000 events/day -- still trivial for Postgres.

**The real concern** is not volume but latency. Firing a serverless function per telemetry event adds latency to user interactions. Solution: batch on the client. Accumulate events in memory, flush every 30 seconds or on page unload via `navigator.sendBeacon()`. One API call with 5-20 events batched.

**Verdict:** Fits with client-side batching. No new infra.

### 3. Tiered Storage -- PARTIALLY, defer cold tier

Hot tier (active signals, recent events): primary Neon DB. Works today.

Warm tier (30-180 day events): Neon supports table partitioning natively. Partition the events table by month. Drop indexes on old partitions. This is pure Postgres -- no new infra.

Cold tier (180+ days to S3/R2): This is the one piece that doesn't fit cleanly on Vercel. You'd need:
- A cron job that exports old partitions to CSV/JSON
- An object storage bucket (Vercel Blob, or Cloudflare R2 since Neon runs on AWS)
- An admin endpoint to query cold data

**Verdict:** Hot + warm work natively. Cold tier can be deferred -- at 500 users, you won't hit 180 days of data volume that stresses Postgres for probably 18+ months. When you do, the migration is a cron job + object storage, not a platform change.

### 4. API Versioning -- YES, trivially

Astro file-based routing supports nested directories. Move `/pages/api/intel/feed.ts` to `/pages/api/v1/intel/feed.ts`. That's it. Vercel routes it automatically.

**Concern:** Redirect old paths for any existing clients (Discord bot, etc). A simple middleware or Vercel rewrite rule handles this.

**Verdict:** No infra change. Just file reorganization.

### 5. Data Export -- YES

A serverless function that runs a few SQL queries and streams CSV/JSON. The only concern is timeout -- a full history export for a power user (30+ casinos, 365 days of claims) could be large. Vercel Pro allows 60s function timeout, which is plenty for streaming query results.

**Alternative if timeout is tight:** Generate export async. User clicks "Export", function queues the job by writing a row to an `export_requests` table, next cron cycle picks it up, generates the file, stores to Vercel Blob, sends push notification with download link.

**Verdict:** Fits. Direct streaming for most users, async for edge cases.

### 6. Trust-Gated Publishing (timed holds) -- THE REAL CHALLENGE

The design says:
- Trust >= 0.65: instant publish
- Trust 0.40-0.64: publish after 5-min dedup window
- Trust < 0.40: 30-min auto-publish or trusted confirmation

This requires signals to transition from "held" to "published" after a delay. Currently, the auto-publish cron runs every 15 minutes. That works for the 30-min hold (signal waits 1-2 cron cycles). But the 5-minute hold doesn't align well with a 15-minute cron cycle.

**Options:**
a) **Increase cron frequency to 5 minutes.** Vercel supports 1-minute cron granularity on Pro. Cost: more function invocations, but the auto-publish function is lightweight.
b) **Publish inline during submission.** When a 0.40-0.64 trust user submits, the API endpoint checks for duplicates synchronously (fast query), and if no dupe found after a brief check, publishes immediately. The 5-minute window becomes "check for dupes at submission time" rather than "hold for 5 minutes."
c) **Use Vercel's `waitUntil()` (edge runtime) or `setTimeout` equivalent.** Not reliable on serverless -- function may be killed.

**Recommendation:** Option (b) is the pragmatic choice. The 5-minute hold's purpose is dedup, not delay. Check for duplicates at submission time (casino_id + type + 4-hour window query). If no match, publish immediately. If match found, convert to confirmation. The hold window is an implementation detail, not a user-facing feature. For <0.40 trust, keep the cron-based 30-min auto-publish.

**Verdict:** Works with slight design adaptation. No infra change.

### 7. Trending Detection -- YES, with cron

Design: detect N trusted warnings about same casino in 6-hour window.

This is a SQL query: count distinct trusted submitters with platform_warning signals per casino in the last 6 hours. Run it on the health computation cron (every 30 minutes). If threshold exceeded, create a trending banner.

**Concern:** 30-minute detection granularity means a fast-moving crisis could take up to 30 minutes to surface. At 500 users, this is acceptable. At 5000 users, you'd want event-driven detection (publish a message on signal creation, consumer checks trending in real-time). That's the point where you'd outgrow Vercel cron.

**Verdict:** Fits at target scale. Would need rethinking at 5000+ users.

### 8. Consolidation / Curated Feed -- YES, compute on read

The curated feed groups signals by casino+type and applies composite scoring. This is a SQL query with GROUP BY, window functions, and computed sort scores. Postgres is excellent at this.

**Concern:** Query complexity. A curated feed query might involve: active signals JOIN casinos JOIN signal_votes (aggregated), with decay weight calculations, group by casino+type, and composite scoring. This could be slow if not properly indexed.

**Mitigation:** Materialized views or pre-computed feed scores (updated by cron every 5-15 minutes). The curated feed doesn't need real-time accuracy -- a 5-minute delay is imperceptible.

**Verdict:** Fits. May need a materialized view for performance at scale.

---

## What Doesn't Fit (and when it matters)

| Feature | Issue | When It Matters | Mitigation |
|---|---|---|---|
| Cold tier storage (S3/R2 export) | Vercel has no native object storage cron | ~18 months from now | Vercel Blob or external R2. Simple cron job. |
| Real-time trending detection | 30-min cron granularity | 5000+ users | Upgrade cron to 1-min; or move to event-driven (Inngest, Trigger.dev) |
| Sub-minute publish holds | Serverless functions can't "sleep" | Never (dedup at submission time is better) | Design adaptation: sync dedup check, not timed hold |
| Heavy export for power users | 60s function timeout | Edge case | Async export via cron + Vercel Blob |

---

## Bottom Line

The full v2 pipeline as designed is implementable on Neon + Vercel + cron at the 500-user target scale. The stack's real limitation is async processing -- anything that needs "do X, wait N minutes, then do Y" doesn't map cleanly to serverless + cron. But the design can be adapted to work synchronously (dedup check on write) or via cron cycles (auto-publish, trending detection) without sacrificing the user experience.

The point where this stack genuinely creaks is ~2000-5000 active users with high signal volume (500+ signals/day). At that scale, you'd want:
- A proper background job system (Inngest or Trigger.dev -- both Vercel-native)
- More aggressive caching (Redis via Upstash, or Vercel KV)
- Possibly read replicas for analytics queries

But those are good problems to have. Building for 500 users on the current stack is correct. Building for 5000 users on the current stack before you have 500 is premature optimization -- exactly what we've deferred before and should defer again.

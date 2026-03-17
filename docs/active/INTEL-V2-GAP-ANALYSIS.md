# Intelligence Layer v2 — Gap Analysis & Implementation Plan

> **Status:** Working document. Gap analysis complete. Sequencing proposed.
> **Date:** 2026-03-18
> **Context:** Dylan resolved all 9 system-wide tensions. This document maps the design to what exists, identifies every gap, and proposes an implementation sequence.

---

## Gap Analysis: What Exists vs. What's Designed

### Domain 1: Signal Lifecycle

| Design Feature | Current State | Gap |
|---|---|---|
| Trust-gated publishing (≥0.65 instant, 0.40-0.64 5-min hold, <0.40 30-min auto-publish) | Binary: trust ≥ 0.65 bypasses age/claim gate. No hold queue. Auto-publish cron uses flat 120-min delay + confidence='high' filter | **Major.** Need tiered hold logic, trust-gated publish times, and warning-type fast-track |
| Signal priority tiers (critical/high/normal/low) | No priority concept. All signals have equal visual weight | **Major.** New column, sort logic, banner treatment for critical signals |
| Type-dependent aging curves (promo codes decay fast, warnings don't decay by time) | No aging. Signals sort by created_at. Expired signals hidden by `expires_at` | **Major.** New decay weight system, display prominence calculation |
| Dedup: casino_id + type + 4-hour window, with "also reported by" confirmations | Content hash only (`content_hash` column exists). No confirmation system | **Major.** Need confirmation_count, first_reporter_id, "also reported by" UI |
| Two terminal states: `expired` vs `debunked` | One terminal path: `collapsed` (vote-driven). Expired is display-only (`expires_at`) | **Medium.** New status values, different trust impacts per terminal state |
| Append-only correction notes (max 3 per signal) | No update/correction mechanism | **Medium.** New table or JSON column for signal updates |
| Default anonymous submissions (sticky preference) | Default attributed. `is_anonymous` toggle exists | **Small.** Flip default, add `anonymous_preference` to user_settings |

### Domain 2: Trust & Reputation

| Design Feature | Current State | Gap |
|---|---|---|
| Reweighted formula: Activity 25%, Submissions 35%, Community 20%, Portfolio 20% | Activity 20%, Submissions 30%, Community 15%, Portfolio 35% | **Medium.** Weight change in trust.ts — simple but impacts all scores |
| Cold start at 0.45 (not 0.50), 3-day/3-claim gate (not 7-day/5-claim) | Start at 0.50, gate at 7 days or 5 claims | **Small.** Constants change |
| Referral vouching (trusted user invites, -0.03 penalty if invitee's signals debunked) | No referral system | **Medium.** New referral table, vouching logic, trust penalty |
| Vote weighting by voter trust score | Flat votes — all equal weight | **Major.** Changes signal status calculation, vote impact on trust |
| Revenge downvote protection (cap negative votes from same user on same submitter) | No protection | **Medium.** New check in vote processing |
| Trust decay: 0.01/month after 60 days inactivity (not 0.02 after 30) | Not implemented (no decay logic found in cron) | **Medium.** Add to trust cron |
| Trust visibility: score + directional breakdown + 90-day sparkline | Trust score exists but not exposed to user in UI | **Medium.** New UI component, API endpoint for trust breakdown |
| Demotion from consistency buffer (last 10 signals worked ratio) | Demotion logic exists per tier but no "consistency buffer" for trusted users | **Small.** Add buffer logic to trust penalty calculation |

### Domain 3: Discovery

| Design Feature | Current State | Gap |
|---|---|---|
| Three-mode discovery (onboarding/growth/expert) | Single flat recommendation list | **Major.** Mode detection, different ranking algorithms per mode |
| Blended scoring (daily value 40%, portfolio gap 30%, intel boost 20%, collab filtering 10%) | No explicit scoring algorithm. Manual/editorial curation | **Major.** Need scoring engine |
| Intel-informed boosting with decay and caps (+30% max) | No intel boost in discovery | **Medium.** Query active signals, compute boost |
| Diversity factor gated by affiliate links | `has_affiliate_link` column exists. No diversity logic | **Medium.** Add diversity scoring, affiliate gate |
| Negative signal handling (90-day personal suppression, mass removal admin flag) | No removal tracking for discovery suppression | **Medium.** Track removals, suppress in recommendations |
| Recency suppression (rotate stale recommendations down) | No impression tracking | **Medium.** Need `discovery_impressions` table or counter |
| Collaborative filtering ("users who track X also track Y") | Not implemented | **Deferred.** Design says weight stays low until 100+ users. Skip for now. |
| Quiet expert influence (top-quartile portfolio → 1.5x collab weight) | Not implemented | **Deferred.** Depends on collab filtering. |

### Domain 4: Community Intelligence at Scale

| Design Feature | Current State | Gap |
|---|---|---|
| Two-layer feed (curated default + raw toggle) | Single chronological feed sorted by status then created_at | **Major.** Consolidation logic, composite scoring, toggle UI |
| Consolidation with disagreement visibility ("mixed results" indicator) | No consolidation. Each signal is individual | **Major.** Grouping logic, mixed results detection, state inference |
| Dynamic trending thresholds: min(5, ceil(users/100)) trusted users + 6hr window | No trending detection | **Major.** New detection logic, banner system |
| Cross-casino parent company badges (informational, not auto-escalation) | `parent_company` exists on casinos. No linkage alerts | **Medium.** Query sibling health, display badge |
| Auto state-tagging from submitter's home_state | `home_state` on user_settings. No auto-tagging on signals | **Small.** Add state to signal on submission |
| First reporter rate tracking + "Early Bird" recognition | No first reporter tracking | **Medium.** New column, computation in tier cron |
| Admin-pinned signals that override algorithmic sorting | No pin mechanism | **Small.** New `is_pinned` column + sort priority |
| No volunteer moderators in v2 (admin only, but build delegation infra) | Admin-only moderation. No delegation infra | **Medium.** Permissions model, audit trail table, appeal flow schema |

### Domain 5: Data Architecture

| Design Feature | Current State | Gap |
|---|---|---|
| Selective event sourcing (user actions, material state changes, admin actions) | No event log. Hard deletes. No audit trail | **Major.** New `events` table, event recording in all mutation paths |
| Behavioral telemetry (anonymous session-keyed events) | No telemetry | **Major.** New table, client-side event emission, opt-in attribution |
| Tiered storage (hot/warm/cold) | Single tier. All data in primary DB | **Deferred.** Not needed until data volume justifies it. Design the schema now, implement partitioning later |
| API versioning (/api/v1/) | No versioning. All endpoints at /api/ | **Medium.** Route prefix change, backwards compatibility |
| Data export (JSON + CSV via settings page) | No export functionality | **Medium.** New API endpoints, settings UI |
| Sticky health recovery (14/30/60 day cool-downs, admin clear, or positive counter-signals) | Health recomputed every cron cycle. No sticky recovery | **Major.** Fundamental change to health computation |

---

## Sequencing: What to Build and In What Order

### Principles

1. **Schema first.** Every phase starts with the migration. Get the data model right before touching business logic.
2. **Foundation before features.** Event sourcing and the trust reweight unlock everything else. Build those first.
3. **Don't break what works.** Current signal submission, voting, and feed work. Evolve them, don't rewrite from scratch.
4. **One Codex prompt per phase.** Each phase is self-contained and deployable.
5. **Dylan's resolutions are constraints, not suggestions.** Every gap must close.

### Proposed Phases

#### Phase 0: Schema Migration & Event Sourcing Foundation
*Prerequisite for everything. No visible behavior change.*

- Add columns to `discord_intel_items`: `signal_priority` (enum: critical/high/normal/low), `first_reporter_id`, `confirmation_count`, `debunked_at`, `state_tags` (text[]), `is_pinned`
- Add `signal_confirmations` table (signal_id, user_id, created_at)
- Add `signal_updates` table (signal_id, author_id, content, created_at) — max 3 per signal enforced in app
- Add `events` table for selective event sourcing
- Add `anonymous_preference` to `user_settings` (default true per Dylan's resolution)
- Add `trust_last_activity_at` to `user_settings` for decay tracking
- Add `health_downgraded_at`, `health_recovery_eligible_at` to `casino_health` for sticky recovery
- Add `moderation_actions` table (id, admin_id, action_type, entity_type, entity_id, reason, created_at) — audit trail skeleton
- Run migration. Backfill `signal_priority` from `item_type` mapping. Backfill `first_reporter_id` from `submitted_by` where `is_anonymous = false`.

#### Phase 1: Trust System Reweight + Decay + Vote Weighting
*Foundation. Changes how every signal and vote is evaluated going forward.*

- Update trust.ts weights: Activity 25%, Submissions 35%, Community 20%, Portfolio 20%
- Cold start: 0.45, gate at 3 days / 3 claims
- Add decay: 0.01/month after 60 days inactivity, floor 0.25, pause on login
- Implement vote weighting by voter trust in `voteOnSignal()` and `updateSignalStatus()`
- Add revenge downvote protection: cap at 2 signals' worth per submitter per 24 hours
- Add consistency buffer: if trusted user's last 10 signals >70% worked, cap penalty at -0.04
- Record events for trust changes > 0.05 and tier transitions

#### Phase 2: Signal Lifecycle Overhaul
*The core behavior change. How signals are created, published, aged, and resolved.*

- Trust-gated publishing: ≥0.65 instant, 0.40-0.64 5-min hold, <0.40 30-min auto-publish. Warnings always within 5 min.
- Replace current auto-publish cron with the new tiered logic
- Signal priority assignment on creation (map item_type → priority tier)
- Dedup: casino_id + type + 4-hour window. First reporter keeps identity, subsequent become confirmations
- Default anonymous with sticky preference
- Auto state-tagging from submitter's home_state
- Two terminal states: `expired` (neutral trust impact) vs `debunked` (negative trust impact)
- Correction notes: append-only, max 3 per signal, visually distinct
- Record events for signal state changes

#### Phase 3: Health System — Sticky Downgrades
*Changes how casino health works. Implements Dylan's "fast down, slow up" resolution.*

- Fast downgrade: amber at 3 trusted (≥0.40) warning reports in 6 hours, full alert at 6+ or admin escalation
- Sticky recovery: no auto-recovery on cron. Recovery requires:
  - Admin manual clear, OR
  - Cool-down with zero new negatives (14 days watch, 30 days at_risk, 60+ days critical), OR
  - Meaningful positive counter-signals from multiple users
- Record `health_downgraded_at` and compute `health_recovery_eligible_at`
- Cross-casino parent company badge (informational only)
- Admin health override still works, now with audit trail via events table

#### Phase 4: Feed Overhaul — Two-Layer Architecture
*The big UI change. Curated default + raw toggle.*

- Curated view: consolidate signals by casino+type, composite scoring (recency × vote ratio × submitter trust × priority), smart summaries
- Raw view: chronological, all individual signals with full attribution
- Mixed results indicator when >20% negative votes, with state breakdown
- Signal priority visual treatment (critical → persistent banner, high → accent, normal → standard, low → muted)
- Type-dependent display: aging curves affect sort weight, not visibility
- Admin-pinned signals override sort in both views
- Trending detection: dynamic threshold min(5, ceil(users/100)) trusted users in 6hr window → banner (not auto-escalation)

#### Phase 5: Discovery Algorithm
*Personalized recommendations replacing flat list.*

- Mode detection: onboarding (0-5 casinos), growth (6-15), expert (16+)
- Onboarding: top 5 by estimated daily value in user's state, tier S/A only
- Growth: blended score — 40% daily value, 30% portfolio gap, 20% intel boost, 10% collab (redistributed to value until 100+ users)
- Expert: "opportunities you're missing" (active signals at untracked casinos) + "intel gaps" (high users, low signals)
- Diversity factor gated by `has_affiliate_link`
- Intel boost capped at +30%, decays with signal age
- Recency suppression: track discovery impressions, rotate stale recs down
- Negative signal: 90-day personal suppression after casino removal

#### Phase 6: Data Architecture Polish
*The infrastructure layer. API versioning, export, telemetry.*

- API versioning: /api/v1/ prefix for external-facing endpoints (feed, vote, submit)
- Data export: JSON + CSV for submission history, vote history, claim history, ledger, trust history. Available via settings page
- Behavioral telemetry: anonymous session-keyed events (feed_view, signal_expand, casino_track/untrack). Opt-in attribution for personalized recommendations
- Moderation delegation infra: permissions model, audit trail complete, appeal flow schema (not activated — Dylan stays sole moderator)
- First reporter rate tracking + Early Bird recognition in tier cron
- Trust visibility UI: score + directional breakdown + 90-day sparkline on settings/profile page

---

## Complexity & Risk Assessment

| Phase | Estimated Scope | Risk | Notes |
|---|---|---|---|
| 0 | Medium | Low | Pure schema. No behavior change. Safe to run first. |
| 1 | Medium | Medium | Trust reweight changes every user's score. Need to recompute all at once. Test that no one gets locked out. |
| 2 | Large | High | Most complex phase. Publishing flow, dedup, confirmations, terminal states all change simultaneously. Consider splitting into 2a (publishing) and 2b (dedup + terminal states). |
| 3 | Medium | Medium | Health is safety-critical. False alarms on real casinos damage trust. Need careful threshold tuning. |
| 4 | Large | Medium | Big UI change but isolated to intel components. Can ship incrementally (curated view first, raw toggle second). |
| 5 | Medium | Low | Discovery is additive — doesn't break existing features. Can ship mode by mode. |
| 6 | Medium | Low | Infrastructure. Most items are additive endpoints. API versioning needs careful routing. |

---

## Dependencies

```
Phase 0 (schema) → everything
Phase 1 (trust) → Phase 2 (vote weighting needed for signal status), Phase 3 (trusted reports for health)
Phase 2 (signals) → Phase 4 (feed needs new signal fields)
Phase 3 (health) → can run parallel with Phase 2 after Phase 1
Phase 4 (feed) → Phase 2 must be complete
Phase 5 (discovery) → Phase 2 (needs intel boost data)
Phase 6 (infra) → can run parallel after Phase 0
```

Critical path: 0 → 1 → 2 → 4
Parallel track A: 0 → 1 → 3
Parallel track B: 0 → 6

---

## Open Questions for Dylan

1. **Phase 2 split:** The signal lifecycle overhaul is the riskiest phase. Should we split it into 2a (trust-gated publishing + priority + default anonymous) and 2b (dedup/confirmations + terminal states + corrections)? This adds a deploy cycle but reduces blast radius.

2. **Trust recomputation:** When we change the formula weights, every user's score shifts. Do we want a one-time recompute and accept the jump, or gradually transition (e.g., 50/50 blend of old/new weights for 2 weeks)?

3. **Health thresholds:** The design says "3 trusted reports → amber." Current system uses weighted warning decay scores. Do we want to keep the decay math and layer the trusted-report-count trigger on top, or replace the decay system entirely?

4. **API versioning scope:** Should /api/v1/ cover ALL endpoints (including admin, cron) or just the user-facing ones (feed, vote, submit, ledger, settings)? Design says internal endpoints don't need versioning — confirming.

5. **Behavioral telemetry timing:** This is foundational data that gets more valuable the longer it collects. Should we ship the telemetry collection (Phase 6 item) earlier — even as part of Phase 0 — so we're gathering data while building the rest?

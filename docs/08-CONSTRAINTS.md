# SweepsIntel — Constraints, DB Efficiency & Future

## Hard constraints

- All Neon queries through `src/lib/db.ts`. No inline connection strings.
- `reporter_ip_hash` is always SHA-256. Hash server-side. Never store raw IPs.
- SC balance for a user+casino is always calculated dynamically (ledger + pending redemptions). Never stored as a static column.
- Affiliate link resolution always comes from `casinos.affiliate_link_url` in Neon. MDX `affiliateLink` field is editorial reference only — never used for live clicks.
- The limbo state machine is non-negotiable. Redemption confirmed → ledger entry. Not before.
- No tax calculations, tax fields, or tax language anywhere. P/L = money in minus money out.
- Multi-user from day one. Every personal data query is scoped to `user_id`.
- Admin routes check `user_settings.is_admin = true`. No other mechanism grants admin access.
- Community volatility reports use `trust_score_at_report` for weighting. Never show individual reports attributed to a user (only aggregated consensus).
- `reset_time_local` is a VARCHAR(5) HH:MM string. Not a TIME type.
- `streak_mode` values are `'rolling'` and `'fixed'`. Not `'rolling_24h'` or `'fixed_time'`.

**Transaction boundaries — these operations MUST be atomic (single DB transaction, rollback on any failure):**
- **Claim flow:** `daily_bonus_claims` INSERT + `ledger_entries` INSERT. If ledger entry fails, claim must not persist. Both or neither.
- **Add-casino with affiliate:** `user_casino_settings` INSERT/UPDATE + `clicks` INSERT (when `fire_affiliate: true`). If settings row fails, don't log the click.
- **Redemption confirm:** `redemptions` UPDATE (status → received, confirmed_at) + `ledger_entries` INSERT (redeem_confirmed). If ledger entry fails, don't confirm the redemption.
- **State pullout alert:** `casino_state_availability` UPDATE + `state_pullout_alerts` INSERT + `user_notifications` batch INSERT. If notification fan-out fails, alert still persists (notifications can be retried, but the data update must not roll back).
- **Provider cascade:** All `casino_state_availability` UPDATEs + `state_pullout_alerts` INSERT + `user_notifications` batch INSERT. All-or-nothing for the cascade. If admin cancels the modal, nothing changes.
- **Everything else** can be single-statement operations (no explicit transaction needed).

---

## Responsive design

Build mobile-first. The daily tracker, redemption list, and ledger are daily-use tools — users will access them on phones. Codex should make responsive implementation decisions per-component. Admin panel can be desktop-optimized (Dylan uses desktop). No specific mobile wireframes — use standard responsive patterns (stack on narrow, table on wide). Tailwind utility classes handle this naturally.

---

## Caching strategy

Codex decides caching per-route. One constraint is specified: redemption time stats use a 1-hour application-level cache per casino (see redemption stats section). Everything else follows the same principle — cache expensive aggregations, invalidate on writes. For data that changes infrequently (casino profiles, state availability), longer caches are fine. For tracker status and claim data, low or no caching — freshness matters. When data volume grows, nightly materialized views for aggregations (redemption stats, volatility consensus) are the upgrade path.

---

## What the data model leaves room for (don't build, don't block)

- **Offer management:** `offers` table with `cost_usd`, `face_value_sc`, `rtp_pct`, `status`, `expires_at`. Margin math: `expected_return_sc = face_value_sc * rtp_pct`, `expected_profit_usd = expected_return_sc - cost_usd`. The `offer` ledger entry type already exists.
- **Wash/betting sessions:** `play_sessions` table (casino_id, game_name, start_sc, end_sc, start_washed, end_washed, sc_per_spin, washed_mode). Reference `Casino/web/lib/v2/ledger.ts → deriveSessionMetrics`. This is the "advanced mode" backend.
- **Washed balance auto-calculation:** Premium experimental. Best-effort from sessions. Always self-editable. Labeled approximate. Cannot be made accurate due to: casino-specific loss-deletion rules, split playthrough, variable game-type multipliers. Do not promise accuracy. Implement when premium tier activates.
- **Stuck redemption alerts (personal):** When a user's pending redemption exceeds the casino's p80 × 1.1 days, surface a flag in `/redemptions`. Uses stats from `redemption-stats.ts` applied personally.
- **Cross-wash bet sizing calculator:** Given user's casino A SC balance, casino B SC balance, target wash amount, live game provider, compute bet sizes for both sides. Needs to account for the fact that each bet is sent to both sides simultaneously. Roulette cross-wash requires a third account to cover zero/green. This is premium, high-risk intel — paywall it.
- **Premium feature gate:** Add `plan VARCHAR(20) DEFAULT 'free'` to `user_settings`. Gate items behind `plan = 'premium'`.
- **Discord intel feed integration:** `discord_intel_items` table and `admin_flags` table are both designed to receive content from Discord monitoring sessions. The admin panel handles publishing. The monitoring itself runs as a two-stage Claude pipeline (Sonnet extraction → Opus interpretation) via Claude-in-Chrome (separate from the app). See Feature #14 for the site-side display. **Full monitoring pipeline architecture, signal filtering rules, trust tiers, and confidence scoring are documented in `MONITORING-SPEC-v1.md` in this directory.** Codex should read that spec to understand what the ingest endpoint will receive and how the `confidence`/`confidence_reason` fields on `discord_intel_items` are populated.
- **Discord sentiment deep dives:** Regular per-casino scrapes of #bearcave-chat comparing user sentiment over time. Needs historical baseline before it's meaningful — build after initial data pipeline is established. AI generates mini-report → flags to Dylan → Dylan adjusts internal calibration or pushes to premium.
- **Streamer schedule + weekly calendar:** `streamers` + `streamer_schedules` tables. Daily display of who is streaming where and when, plus a weekly calendar view (e.g., "Thirsty Thursday at Legendz" recurring events). Weekly Discord scrape to validate recurring schedules haven't changed. High SEO value. Early post-MVP.
- **Community jackpot tracker:** Per-casino tool for casinos with community jackpots requiring regular spins. Alert at threshold, "I just spun" tracker with 6h timer. Niche but sticky for affected casinos. Post-MVP.
- **Trust score automation:** Currently manual. Future: auto-adjust based on corroboration patterns (your volatility report matches 10 others = trust bump; your reports consistently outlier = trust reduction).

---

## Database efficiency — minimize Neon costs per user

Neon bills by compute time and data transfer. Every unnecessary round-trip and every unindexed scan costs real money at scale. The tracker page loads daily for every active user — it is the critical cost path. This section is prescriptive: follow these patterns exactly.

---

### Critical indexes to add (beyond what's already in the schema)

```sql
-- Tracker Section 1: fast lookup of active tracked casinos per user
CREATE INDEX idx_ucs_user_active ON user_casino_settings(user_id) WHERE removed_at IS NULL;

-- Tracker My Alerts: published intel items by casino for feed filtering
CREATE INDEX idx_discord_intel_casino_published ON discord_intel_items(casino_id, is_published, created_at DESC) WHERE is_published = true;

-- Push notifications: active subscriptions per user
CREATE INDEX idx_push_subs_user_active ON push_subscriptions(user_id) WHERE is_active = true;

-- Ledger affiliate gate check: fast EXISTS query per user+casino
CREATE INDEX idx_ledger_user_casino_exists ON ledger_entries(user_id, casino_id);

-- Homepage top-rated: tier+rating for the top-6 query
CREATE INDEX idx_casinos_tier_rating ON casinos(tier, rating DESC NULLS LAST) WHERE rating IS NOT NULL;

-- Admin dashboard: pending counts across multiple tables (partial indexes for queue counts)
CREATE INDEX idx_ban_reports_pending ON ban_reports(id) WHERE is_published = false;
CREATE INDEX idx_state_reports_pending ON state_availability_reports(id) WHERE is_published = false;
CREATE INDEX idx_reset_suggestions_pending ON reset_time_suggestions(id) WHERE status = 'pending';
CREATE INDEX idx_admin_flags_pending ON admin_flags(id) WHERE status = 'pending';
CREATE INDEX idx_casinos_user_suggested ON casinos(id) WHERE source = 'user_suggested';
```

---

### Route-by-route query plan — eliminate N+1 patterns

**`/tracker` — the critical daily-use path (target: 3 queries max for logged-in user)**

Do NOT query per-casino in a loop. Consolidate into three queries:

**Query 1 — Section 1 (user's tracked casinos + today's claim status):**
```sql
SELECT
  ucs.casino_id, ucs.sort_order, ucs.typical_daily_sc, ucs.personal_notes,
  c.name, c.slug, c.streak_mode, c.reset_time_local, c.reset_timezone,
  c.has_streaks, c.sc_to_usd_ratio, c.has_affiliate_link, c.source,
  c.daily_bonus_desc,
  dbc.id AS today_claim_id, dbc.sc_amount AS today_sc, dbc.claimed_at AS today_claimed_at
FROM user_casino_settings ucs
JOIN casinos c ON c.id = ucs.casino_id
LEFT JOIN daily_bonus_claims dbc
  ON dbc.user_id = ucs.user_id
  AND dbc.casino_id = ucs.casino_id
  AND dbc.claimed_date = CURRENT_DATE
  AND dbc.claim_type = 'daily'
WHERE ucs.user_id = $1 AND ucs.removed_at IS NULL
ORDER BY ucs.sort_order ASC NULLS LAST;
```

**Query 2 — Streak data (only for casinos with `has_streaks = true`, batch):**
```sql
SELECT DISTINCT ON (casino_id)
  casino_id, claimed_at
FROM daily_bonus_claims
WHERE user_id = $1
  AND casino_id = ANY($2::int[])
ORDER BY casino_id, claimed_at DESC;
```
Pass `$2` as the array of casino_ids where `has_streaks = true` from Query 1. If no streak casinos, skip this query entirely.

**Query 3 — My Alerts (personalized intel feed):**
```sql
SELECT id, item_type, casino_id, title, content, expires_at, confirm_count, dispute_count, created_at
FROM discord_intel_items
WHERE is_published = true
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (casino_id = ANY($2::int[]) OR casino_id IS NULL)
ORDER BY created_at DESC
LIMIT 20;
```
Pass `$2` as the user's tracked casino_ids from Query 1.

**Section 2 (casinos to add) — separate API call, lazy-loaded:**
Section 2 is below the fold. Do NOT load it on initial page render. Load via a separate `GET /api/tracker/suggestions` call triggered by scroll or a "Show more casinos" button. This keeps the initial page load to the 3 queries above.

```sql
SELECT c.id, c.name, c.slug, c.daily_bonus_desc, c.has_affiliate_link, c.affiliate_link_url, c.tier,
  COALESCE(agg.avg_sc, c.daily_bonus_sc_avg) AS sort_sc
FROM casinos c
LEFT JOIN (
  SELECT casino_id, AVG(sc_amount) FILTER (WHERE sc_amount > 0) AS avg_sc
  FROM daily_bonus_claims
  GROUP BY casino_id
) agg ON agg.casino_id = c.id
WHERE c.source = 'admin'
  AND c.is_excluded = false
  AND c.id NOT IN (SELECT casino_id FROM user_casino_settings WHERE user_id = $1 AND removed_at IS NULL)
ORDER BY sort_sc DESC NULLS LAST;
```

**Anti-pattern to avoid:** Do NOT query `daily_bonus_claims` per-casino in a JavaScript loop. The LEFT JOIN in Query 1 handles this in a single round-trip. Do NOT compute streak status per-casino by querying claim history individually — Query 2 batches all streak lookups. Codex MUST consolidate, not iterate.

---

**`/casinos/[slug]` — casino profile (target: 4-5 queries, parallelized)**

Run these queries in parallel (Promise.all), not sequentially:

1. Casino row: `SELECT * FROM casinos WHERE slug = $1` (1 row)
2. Providers + games: `SELECT clgp.provider_id, gp.name, gp.slug FROM casino_live_game_providers clgp JOIN game_providers gp ON gp.id = clgp.provider_id WHERE clgp.casino_id = $1` + `SELECT * FROM casino_game_availability WHERE casino_id = $1 AND status != 'removed' ORDER BY confidence DESC, game_name` (two fast indexed queries, can be combined into one with a UNION or run separately — both are cheap)
3. Ban reports + uptick: `SELECT * FROM ban_reports WHERE casino_id = $1 AND is_published = true ORDER BY submitted_at DESC LIMIT 20` + `SELECT 1 FROM ban_uptick_alerts WHERE casino_id = $1 AND is_active = true LIMIT 1`
4. Redemption stats: **Cached 1 hour in application memory.** If cache miss, run the redemption stats query (already defined in the spec). Store result in a Map keyed by casino_id with TTL.
5. Published intel: `SELECT * FROM discord_intel_items WHERE casino_id = $1 AND is_published = true AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 10`
6. State availability: `SELECT csa.*, sls.state_name FROM casino_state_availability csa JOIN state_legal_status sls ON sls.state_code = csa.state_code WHERE csa.casino_id = $1`

**Affiliate gate check** (only if user is authed): `SELECT 1 FROM ledger_entries WHERE user_id = $1 AND casino_id = $2 LIMIT 1` — this is why `idx_ledger_user_casino_exists` matters.

---

**`/` — homepage (target: 3 queries, all cacheable)**

1. Top-rated casinos: `SELECT id, name, slug, tier, rating, daily_bonus_desc, has_affiliate_link FROM casinos WHERE tier IN (1,2) AND rating IS NOT NULL ORDER BY tier ASC, rating DESC LIMIT 6` — **cache 15 minutes** (casino ratings change infrequently).
2. Recent pullout alerts: `SELECT spa.*, c.name, c.slug FROM state_pullout_alerts spa LEFT JOIN casinos c ON c.id = spa.casino_id WHERE spa.created_at > NOW() - INTERVAL '30 days' ORDER BY spa.created_at DESC LIMIT 5` — **cache 5 minutes.**
3. Intel teaser: `SELECT id, item_type, title, casino_id, created_at FROM discord_intel_items WHERE is_published = true AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 3` — **cache 2 minutes** (intel items change with publishes).

The homepage is public and fully cacheable. At MVP scale these queries are trivial, but cache them anyway to build good habits. Use a simple in-memory Map with TTL — no Redis needed at this scale.

---

**`/redemptions` (target: 2 queries)**

1. User's redemptions: `SELECT r.*, c.name, c.slug FROM redemptions r JOIN casinos c ON c.id = r.casino_id WHERE r.user_id = $1 ORDER BY r.submitted_at DESC` — already indexed by `idx_redemptions_user_status`.
2. In-transit total: computed from query 1 results in application code (`status = 'pending'`). No separate query needed.
3. Slowdown banners: use the per-casino redemption stats cache (same as casino profile). Check trend signal in application code.

---

**`/ledger` (target: 2 queries)**

1. Paginated entries: `SELECT le.*, c.name FROM ledger_entries le JOIN casinos c ON c.id = le.casino_id WHERE le.user_id = $1 ORDER BY le.entry_at DESC LIMIT 20 OFFSET $2` — already indexed by `idx_ledger_user_casino_date`.
2. P/L summary: `SELECT casino_id, SUM(usd_amount) AS net_usd, SUM(sc_amount) AS net_sc FROM ledger_entries WHERE user_id = $1 GROUP BY casino_id` — single aggregation, no N+1. **Cache 5 minutes per user** (invalidate on new ledger entry).

---

**`/states` (target: 1 query, heavily cached)**

`SELECT sls.*, COUNT(csa.id) FILTER (WHERE csa.status = 'available') AS casino_count FROM state_legal_status sls LEFT JOIN casino_state_availability csa ON csa.state_code = sls.state_code GROUP BY sls.state_code` — **cache 30 minutes.** State data barely changes.

---

**`/admin` dashboard (target: 5-6 count queries, parallelized)**

Admin pages are low-traffic (1 user). Efficiency matters less but good practice still applies. Run all count queries in parallel:
```sql
-- Single query using subqueries for all queue counts at once:
SELECT
  (SELECT COUNT(*) FROM ban_reports WHERE is_published = false) AS pending_bans,
  (SELECT COUNT(*) FROM state_availability_reports WHERE is_published = false) AS pending_states,
  (SELECT COUNT(*) FROM reset_time_suggestions WHERE status = 'pending') AS pending_resets,
  (SELECT COUNT(*) FROM admin_flags WHERE status = 'pending') AS pending_flags,
  (SELECT COUNT(*) FROM discord_intel_items WHERE is_published = false) AS pending_intel,
  (SELECT COUNT(*) FROM casinos WHERE source = 'user_suggested') AS user_suggested;
```
One round-trip for all dashboard counts, using the partial indexes defined above.

---

### Caching strategy — prescriptive per route

| Route | Cache type | TTL | Invalidation |
|---|---|---|---|
| `/` (homepage) | In-memory Map | 5 min (alerts), 15 min (top casinos) | Time-based only |
| `/casinos/[slug]` profile | In-memory Map keyed by slug | 5 min (structured data), 1 hr (redemption stats) | Invalidate on admin edit or new ban report |
| `/tracker` Section 1 | No cache | — | Always fresh (daily-use, claim state changes constantly) |
| `/tracker` Section 2 | In-memory Map per user | 10 min | Invalidate on add-casino |
| `/states` | In-memory Map | 30 min | Invalidate on state update |
| `/states/[code]` | In-memory Map per state | 15 min | Invalidate on state update |
| `/casinos` directory | In-memory Map | 10 min | Invalidate on casino edit |
| Redemption stats per casino | In-memory Map per casino_id | 1 hr | Time-based only |
| Ledger P/L summary | In-memory Map per user_id | 5 min | Invalidate on new ledger entry |
| `/admin/*` | No cache | — | Always fresh (low traffic, needs real-time) |

**Implementation:** Use a simple `Map<string, { data: any, expires: number }>` in `src/lib/cache.ts`. Helper: `getCached(key, ttlMs, fetchFn)`. No Redis, no Vercel KV — in-memory is fine because Vercel serverless functions are ephemeral. The cache lives for the function's warm lifetime (~5-15 minutes), which is close to the TTL targets anyway. This keeps infrastructure cost at zero.

**Nightly materialized views (upgrade path, don't build at MVP):** When `daily_bonus_claims` exceeds ~100K rows, the Section 2 aggregation (average SC per casino) will slow down. At that point, create a materialized view refreshed nightly:
```sql
CREATE MATERIALIZED VIEW mv_casino_avg_sc AS
SELECT casino_id, AVG(sc_amount) FILTER (WHERE sc_amount > 0) AS avg_sc, COUNT(*) AS claim_count
FROM daily_bonus_claims
GROUP BY casino_id;
```
Replace the Section 2 subquery with `SELECT * FROM mv_casino_avg_sc`. Add a Vercel cron job for `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_casino_avg_sc`. Don't build this now — build it when query latency on Section 2 exceeds 200ms.

---

### Cost projection and guard rails

At 100 active daily users (realistic 6-month target), the tracker page generates ~100 page loads/day × 3 queries = 300 queries/day. With Section 2 lazy-loading, add ~50 more. Homepage adds ~200/day from organic traffic. Total: ~1,000-2,000 queries/day across all routes. On Neon's free tier (0.25 compute units), this is comfortably within limits. Paid tier starts at ~$19/month — the platform should not exceed this at MVP scale if queries are consolidated as specified above.

**Guard rails to keep costs low:**
- NEVER use `SELECT *` in production queries. Select only the columns needed for the render.
- NEVER query inside a JavaScript loop. If you need data for N items, use `WHERE id = ANY($1::int[])` or a single JOIN.
- Every query that takes `user_id` as a parameter must hit an index that starts with `user_id`. Check `EXPLAIN ANALYZE` during development.
- Pagination: always use `LIMIT/OFFSET` on list queries. The ledger and redemption lists must never return unbounded rows.
- Section 2 aggregation: lazy-load, don't block initial render.

---

## Open questions for Codex

1. **Casino balance as VIEW vs. application code:** `available_sc = ledger sum - pending redemptions sum` could be a Postgres VIEW per user+casino, or computed in `src/lib/balance.ts`. The view is more portable for future reporting. Application code is easier to debug. What's your preference?

2. **State pullout notification batching:** If 3 casinos all exit a state on the same day (admin processes them in one session), should they batch into one notification per user or send 3 separate ones? Lean toward: one notification per event (they're each meaningful), but combining them if created within the same admin session is worth debating.

3. **Astro island hydration for tracker:** `client:load` vs. `client:idle`. Tracker is the primary UI on `/tracker` so `client:load` seems right. Counter if not.

4. **Admin flag AI summary:** **RESOLVED — not a question for Codex.** `ai_summary` and `proposed_action` are populated by the external Discord monitoring pipeline at ingest time (discord-sourced flags only). Flags from automated in-app detection (ban uptick, trend signals) have no AI summary — admin reads raw content. Both fields are nullable. No background LLM workers needed. Codex just needs to accept them in the ingest payload and display them in the admin UI.

5. **OTP email provider:** Resend is the recommendation. Counter if you'd go elsewhere.

6. **Redemption time caching:** 1-hour application-level cache per casino at MVP. When data volume grows, a nightly materialized view refresh is cleaner. What's your call on the threshold for switching?

7. **Affiliate link redirect:** All affiliate clicks through `/api/affiliate/click` — never embed raw URL in HTML. Confirm this is the right tradeoff (analytics + scraping protection vs. slight latency). **Fallback behavior:** If the API endpoint fails (500, timeout, or Vercel cold start >3s), the client-side click handler must fall back to opening the raw affiliate URL directly from a `data-fallback-url` attribute on the CTA element. Revenue-critical — a broken redirect means lost conversions. Implementation: `fetch('/api/affiliate/click', { ... }).catch(() => window.open(fallbackUrl, '_blank'))`.

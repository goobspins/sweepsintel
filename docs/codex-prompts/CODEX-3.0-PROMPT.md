# SweepsIntel 3.0 — Codex Implementation Prompt

> **Authoritative spec:** `docs/SWEEPSINTEL-3.0-SPEC.md` (Draft v2, feature-complete)
> **Read the full spec first.** This prompt maps spec → code. When they conflict, the spec wins.
> **Do NOT modify the spec files.** You are implementing, not designing.

---

## Ground Rules

1. **Astro hybrid + React islands pattern continues.** New pages are `.astro` files with `export const prerender = false`. React components use `client:load`. Follow the existing pattern in `dashboard.astro` / `DashboardTracker.tsx`.

2. **Raw SQL via `src/lib/db.ts`.** Use `query<T>()` for reads, `transaction()` for multi-statement writes. No ORM. Parameterized queries only (`$1`, `$2`). Follow patterns in `src/pages/api/discord/react.ts` and `src/pages/api/tracker/status.ts`.

3. **Auth pattern:** `requireAuth(request)` returns `SessionUser` or throws. `requireAdmin(request)` for admin routes. Import from `src/lib/auth.ts`. The `SessionUser` interface will need updating (see below).

4. **API route pattern:** Every route exports `const prerender = false`, defines a local `json()` helper, uses try/catch with `isHttpError()`. Follow `src/pages/api/tracker/status.ts` exactly.

5. **Styling:** CSS-in-JS inline styles + scoped CSS via `<style>` blocks. CSS variables from the existing theme (`--accent-blue`, `--accent-green`, `--accent-red`, `--accent-yellow`, `--text-primary`, `--text-secondary`, `--bg-card`, etc.). **No Tailwind.** Follow existing component style patterns.

6. **Migrations are additive.** Create new migration files as `src/db/YYYY-MM-DD-description.sql`. Never modify `schema.sql` directly. The live DB schema is `schema.sql` + all migration files applied in date order.

7. **Component organization:** New components go in feature directories under `src/components/`. E.g., `src/components/intel/`, `src/components/health/`. Follow existing directory convention.

8. **The `DashboardTracker.tsx` is large and fragile.** Approach changes to it carefully. The three-zone redesign means significant restructuring — plan it as a refactor, not a bolt-on.

9. **Cron jobs** are configured in `vercel.json` and routed to `src/pages/api/cron/`. Follow the pattern in `push-resets.ts`. Cron endpoints validate `CRON_SECRET` bearer token.

10. **Cache** is in `src/lib/cache.ts` with TTL-based in-memory caching. Discovery uses `dashboard-discovery:*` prefix. New computed data (health, trust scores) should use similar prefixed cache keys where appropriate.

---

## Phase 1: Database Migration

Create `src/db/2026-03-17-intelligence-layer.sql` with ALL schema changes for 3.0. This is the foundation — everything else depends on it.

### New Tables

```sql
-- Casino health snapshot (computed by background job)
CREATE TABLE casino_health (
  casino_id INT PRIMARY KEY REFERENCES casinos(id),
  global_status VARCHAR(20) NOT NULL DEFAULT 'healthy',
  status_reason TEXT,
  active_warning_count INT DEFAULT 0,
  redemption_trend DECIMAL(6,2),
  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  admin_override_status VARCHAR(20),
  admin_override_reason TEXT,
  admin_override_at TIMESTAMPTZ
);

CREATE INDEX idx_casino_health_status ON casino_health(global_status);

-- User notification preferences
CREATE TABLE user_notification_preferences (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES user_settings(user_id),
  push_warnings BOOLEAN DEFAULT TRUE,
  push_deals BOOLEAN DEFAULT TRUE,
  push_free_sc BOOLEAN DEFAULT TRUE,
  push_streak_reminders BOOLEAN DEFAULT FALSE,
  email_digest_frequency VARCHAR(20) DEFAULT 'none',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signal votes (replaces the cosmetic discord_intel_reactions for new voting system)
CREATE TABLE signal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id INT NOT NULL REFERENCES discord_intel_items(id),
  user_id VARCHAR(255) NOT NULL REFERENCES user_settings(user_id),
  vote VARCHAR(12) NOT NULL CHECK (vote IN ('worked', 'didnt_work')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (signal_id, user_id)
);

CREATE INDEX idx_signal_votes_signal ON signal_votes(signal_id);
```

### Alter Existing Tables

```sql
-- user_settings: add layout preference, trust score default adjustment, contributor tier
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS layout_swap BOOLEAN DEFAULT FALSE;
-- NOTE: trust_score already exists but defaults to 1.0. Update default for new users:
ALTER TABLE user_settings ALTER COLUMN trust_score SET DEFAULT 0.50;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS contributor_tier VARCHAR(30) DEFAULT 'newcomer';
-- Add check constraint for contributor_tier:
ALTER TABLE user_settings ADD CONSTRAINT chk_contributor_tier
  CHECK (contributor_tier IN ('newcomer', 'scout', 'insider', 'operator'));

-- discord_intel_items: add community signal columns
ALTER TABLE discord_intel_items ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'discord';
ALTER TABLE discord_intel_items ADD CONSTRAINT chk_intel_source
  CHECK (source IN ('discord', 'admin', 'user'));
ALTER TABLE discord_intel_items ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(255);
ALTER TABLE discord_intel_items ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
ALTER TABLE discord_intel_items ADD COLUMN IF NOT EXISTS worked_count INT DEFAULT 0;
ALTER TABLE discord_intel_items ADD COLUMN IF NOT EXISTS didnt_work_count INT DEFAULT 0;
ALTER TABLE discord_intel_items ADD COLUMN IF NOT EXISTS signal_status TEXT DEFAULT 'active';
ALTER TABLE discord_intel_items ADD CONSTRAINT chk_signal_status
  CHECK (signal_status IN ('active', 'conditional', 'likely_outdated', 'collapsed'));

CREATE INDEX IF NOT EXISTS idx_discord_intel_source ON discord_intel_items(source);
```

### Important Migration Notes

- The existing `discord_intel_items` table has `confirm_count` and `dispute_count` columns. These remain for backward compatibility with the old `discord_intel_reactions` system. The NEW `worked_count` / `didnt_work_count` columns are driven by the `signal_votes` table. Don't drop the old columns yet.
- The existing `discord_intel_reactions` table remains for backward compatibility. The new `signal_votes` table handles the 3.0 voting system. They coexist.
- `trust_score` already exists on `user_settings` with DEFAULT 1.0. New users should get 0.50. Existing users keep their current value. The ALTER changes the default only.

---

## Phase 2: Library Layer (Business Logic)

These are the shared modules that multiple pages/routes will use. Build these BEFORE the API routes and pages.

### 2A: `src/lib/health.ts` — Casino Health Computation

This is the core health engine. It runs as a cron job AND is called by the health API.

```typescript
// Exports:
// computeAllCasinoHealth() — called by cron, computes and writes to casino_health for ALL casinos
// getCasinoHealth(casinoId) — read single casino health (from cached table)
// getCasinoHealthForUser(casinoId, userId) — applies personal modifier (pending redemptions, exposure)
// getHealthForTrackedCasinos(userId) — bulk: all tracked casinos with personal modifiers

// Health computation logic (from spec):
// Inputs: published platform_warnings (count + recency + vote ratios), redemption trends, promoban changes, admin overrides
// Output levels: healthy | watch | at_risk | critical
// Recency decay curve for warnings:
//   active (not expired): 100% weight
//   expired 0-24h: 75%
//   expired 24-48h: 50%
//   expired 48-72h: 25%
//   expired 72h+: 0%
// Admin override takes absolute precedence when set (admin_override_status on casino_health table)
// Personal modifier: user's pending redemptions at the casino escalate (never reduce) their view
// Thresholds should be constants at the top of the file, clearly labeled as tunable
```

### 2B: `src/lib/intel.ts` — Intel/Signal Operations

Extends the existing `src/lib/discord-intel.ts` with user-submission and voting logic. You may want to add to the existing file or create a new one — use your judgment on file size.

```typescript
// Exports:
// submitUserSignal({ userId, casinoId, signalType, title, details, expiresAt?, isAnonymous }) — creates discord_intel_items row with source='user', is_published=true
// voteOnSignal(signalId, userId, vote: 'worked' | 'didnt_work') — upsert into signal_votes, update denormalized counts
// getIntelFeed({ userId, casinoIds?, type?, since?, limit? }) — paginated signal feed for tracked casinos
// getSignalDetail(signalId) — single signal with full vote breakdown
// updateSignalStatus(signalId) — evaluate vote ratios, update signal_status (active/conditional/likely_outdated/collapsed)

// User signal rules:
// - source='user', submitted_by=userId, is_anonymous per user choice
// - is_published=true immediately (no admin queue)
// - confidence='unverified' for new users, 'medium' for users with trust_score > 0.70
// - Signal types: same item_type taxonomy as discord signals (free_sc, promo_code, flash_sale, playthrough_deal, platform_warning, general_tip)

// Signal status thresholds (constants, tunable):
// - If worked_count > 0 AND didnt_work_count > 0 AND ratio is mixed → 'conditional'
// - If didnt_work_count > N AND worked_count near 0 → 'likely_outdated'
// - If even higher threshold → 'collapsed'
// - Start conservative: likely_outdated at 80%+ didnt_work with 8+ total votes, collapsed at 90%+ with 12+ votes
```

### 2C: `src/lib/trust.ts` — Trust Score Computation

```typescript
// Exports:
// computeTrustScore(userId) — full recalculation for one user
// computeAllTrustScores() — batch, called by cron
// evaluateContributorTier(userId) — check tier promotion/demotion eligibility
// evaluateAllContributorTiers() — batch, called by cron

// Trust score inputs (all weighted, final score 0.00-1.00):
// 1. Account age + activity (days tracking, total claims logged)
// 2. Submission history (worked ratio across all their signals)
// 3. Community standing (net positive votes received)
// 4. Portfolio performance (query ledger_entries for P/L trajectory, query user_casino_settings for portfolio diversity, query daily_bonus_claims for consistency)
//    - Positive P/L + diverse portfolio + consistent claims → boost toward 1.0
//    - Sustained negative P/L → suppress toward lower end (not below 0.20 from portfolio alone)
// 5. Admin manual override (if set, skip computation)
// Weights are constants at top of file, clearly labeled as tunable

// Contributor tier evaluation:
// newcomer → scout: 5+ submissions, >60% worked ratio, account age 14+ days
// scout → insider: 20+ submissions, >70% worked ratio, submission span 30+ days
// insider → operator: admin-only (skip in computation)
// Demotion: scout drops below 40% over last 10 → newcomer. Insider drops below 50% over last 15 → scout.
// Write result to user_settings.contributor_tier
```

### 2D: Update `src/lib/auth.ts` — SessionUser Extension

Add `trustScore`, `contributorTier`, and `layoutSwap` to the `SessionUser` interface. Update `validateSession()` / `getSessionUser()` to SELECT these from `user_settings`.

```typescript
export interface SessionUser {
  userId: string;
  email: string;
  isAdmin: boolean;
  timezone: string;
  ledgerMode: 'simple' | 'advanced';
  trustScore: number;         // NEW
  contributorTier: string;    // NEW
  layoutSwap: boolean;        // NEW
}
```

Update the query in `validateSession` to join/select `trust_score`, `contributor_tier`, `layout_swap` from `user_settings`.

---

## Phase 3: API Routes

### 3A: Intel Feed APIs — `src/pages/api/intel/`

**`feed.ts` (GET)**
- Auth required
- Query params: `casino_id` (optional, single), `type` (optional filter), `since` (ISO timestamp), `limit` (default 50)
- Default: returns signals for ALL casinos in user's tracker (query `user_casino_settings WHERE removed_at IS NULL`)
- Join with `user_settings` for submitted_by user's `contributor_tier` (for badge display)
- Respect `is_anonymous`: if true, return display_name as null (frontend shows "Community member")
- Respect `signal_status`: include 'active' and 'conditional' by default. 'likely_outdated' included but flagged. 'collapsed' excluded unless `show_collapsed=true` param.
- Sort: active signals first (by created_at DESC), then expired signals
- Source column is NEVER returned in the API response (spec: non-negotiable)

**`signal/[id].ts` (GET)**
- Auth required
- Return full signal detail with vote breakdown, related signals (same casino, last 7 days)

**`submit.ts` (POST)**
- Auth required
- Body: `{ casino_id, signal_type, title, details, expires_at?, is_anonymous? }`
- Check minimum activity threshold: user must have 7+ days since account creation AND 5+ claims in daily_bonus_claims. **Portfolio bypass:** if user's trust_score >= 0.65, skip the threshold check entirely.
- Insert into `discord_intel_items` with `source='user'`, `submitted_by=userId`, `is_published=true`, `is_anonymous` per request
- Return the created signal

**`vote/[id].ts` (POST)**
- Auth required
- Body: `{ vote: 'worked' | 'didnt_work' }`
- Upsert into `signal_votes` (one vote per user per signal, changeable)
- Update denormalized `worked_count` / `didnt_work_count` on `discord_intel_items`
- After updating counts, call `updateSignalStatus()` to check if status should change
- Return updated counts

### 3B: Casino Health APIs — `src/pages/api/casinos/`

**`health.ts` (GET)**
- Auth required
- Returns health status for all user's tracked casinos (with personal modifier applied)
- Uses `getHealthForTrackedCasinos(userId)` from `src/lib/health.ts`

**`health-detail/[id].ts` (GET)**
- Auth required
- Returns detailed health breakdown for one casino: status, reason, active warning signals (content + vote counts, NO signal IDs exposed in a way that reveals source), decay state, personal exposure data

### 3C: Admin APIs — `src/pages/api/admin/`

**`casino-health-override.ts` (POST)**
- Admin required
- Body: `{ casino_id, status, reason }`
- Write to `casino_health.admin_override_status`, `admin_override_reason`, `admin_override_at`
- To clear: pass `status: null`

**`signal.ts` (POST)** — admin signal creation
- Admin required
- Body: `{ casino_id, signal_type, title, details, expires_at? }`
- Insert into `discord_intel_items` with `source='admin'`, `is_published=true`, `is_anonymous=false`, `confidence='high'`
- These display as "SweepsIntel Team" in the UI

**`community-digest.ts` (GET)**
- Admin required
- Query param: `period=7d` (default)
- Returns: total signals submitted, worked/disputed/unverified counts, user submission count, flagged users (trust_score < 0.20), top contributors

### 3D: Notification Preferences — `src/pages/api/notifications/`

**`preferences.ts` (GET + POST)**
- Auth required
- GET: return user's notification preferences (create default row if none exists)
- POST: upsert preferences

### 3E: Cron Jobs — `src/pages/api/cron/`

**`compute-health.ts`**
- Validates `CRON_SECRET`
- Calls `computeAllCasinoHealth()` from health.ts
- Add to `vercel.json`: `{ "path": "/api/cron/compute-health", "schedule": "*/30 * * * *" }` (every 30 min)

**`compute-trust.ts`**
- Validates `CRON_SECRET`
- Calls `computeAllTrustScores()` then `evaluateAllContributorTiers()` from trust.ts
- Add to `vercel.json`: `{ "path": "/api/cron/compute-trust", "schedule": "0 */2 * * *" }` (every 2 hours — less frequent than health)

---

## Phase 4: Pages & Components

### 4A: Intel Feed Page — NEW

**`src/pages/intel.astro`**
- Route: `/intel`
- Authenticated page following `dashboard.astro` pattern
- Server-side: fetch initial feed data for user's tracked casinos (first page)
- Render: `<IntelFeed client:load initialData={...} user={...} />`

**`src/components/intel/IntelFeed.tsx`** — main feed component
- Filter bar: casino checkboxes (tracked casinos), type filter (All/Deals/Promos/Free SC/Warnings/Strategy), time filter
- Signal cards with: type badge (color-coded), attribution line (display name OR "Community member" OR "SweepsIntel Team"), contributor badge (if named signal from scout/insider/operator — NO badge on anonymous), casino name linked to `/casinos/[slug]`, title, truncated content, timestamp, expiry indicator, vote counts + vote buttons
- "Worked for me" / "Didn't work" buttons (or "Experiencing this" / "Not affected" for warnings)
- Expandable signal detail (full content, related signals, quick actions)
- Expired signals: muted "Expired" badge, sorted below active
- "Submit Signal" button → opens SignalSubmitForm

**`src/components/intel/SignalCard.tsx`** — individual signal card
**`src/components/intel/SignalSubmitForm.tsx`** — structured submission form
- Casino picker (from tracked list or search)
- Signal type dropdown
- Title, details, expiry (optional), promo code (if applicable)
- "Post anonymously" checkbox (unchecked by default)
**`src/components/intel/VoteButtons.tsx`** — worked/didn't work buttons with counts

### 4B: Nav Update — `src/components/layout/Nav.tsx`

Add Intel Feed to the tools nav, between Dashboard and My Casinos:

```typescript
// In buildToolItems():
return [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/intel', label: 'Intel' },        // NEW
  { href: '/my-casinos', label: 'My Casinos' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/reports', label: 'Reports' },
  { href: '/redemptions', label: 'Redemptions' },
];
```

### 4C: Dashboard Redesign — MAJOR REFACTOR

**This is the biggest frontend change. Approach carefully.**

Current state: `DashboardTracker.tsx` is one large component. The spec calls for three zones.

**Zone 1: Momentum Strip** — current implementation, keep as-is. Thin collapsed strip at top.

**Zone 2: Side-by-Side** — this is the main restructure.
- Left column (default): Casino Dashboard (the current tracker list — `DailyTracker.tsx` + `CasinoRow.tsx`)
- Right column (default): Discovery Queue (the current `PersonalizedIntelFeed.tsx` sidebar, restructured as spotlight cards)
- Swap sides button (persisted to `user_settings.layout_swap` via existing settings API pattern)
- Collapse discovery button (session-scoped, sessionStorage)
- Both columns same height, page scrolls (not columns)

**Zone 3: Under the Fold**
- Earnings prompt: "You're tracking {N} casinos. Adding these {M} could earn you an estimated ${X.XX} more per day."
  - Calculation: sum `daily_bonus_sc_avg * sc_to_usd_ratio` for untracked casinos available in user's state
- Full casino card grid (filterable, sortable) — the expanded discovery
- Latest signal preview card (most recent published intel signal for tracked casinos, links to `/intel`)

**Add health dots to casino rows:** Each casino row in the tracker gets a small colored dot (🟢🟡🔴) next to the casino name. Data comes from `casino_health` table. Casino names become links to `/casinos/[slug]`.

### 4D: My Casinos Health Cards — MAJOR REFACTOR of `MyCasinosBoard.tsx`

Current: simple table/list. Spec: card-based health dashboard.

**Collapsed card (default):**
- Casino name + tier badge (linked to profile)
- Health indicator dot (large, left side — first thing eye hits)
- SC Balance, Net P/L, Last activity, Active alert count badge

**Expanded card (on click, accordion):**
- Section 1: Financial Summary (SC Balance, Total Invested, Total Redeemed, Net P/L, last 10 ledger entries, "View in Ledger" link)
- Section 2: Health Detail (WHY is this casino amber/red — list specific signals with vote counts, clickable to Intel Feed)
- Section 3: Casino Quick Reference (tier, PB risk, redemption speed, daily bonus, personal notes)
- Section 4: Quick Actions (Claim Daily, Log Purchase, Submit Redemption, Visit Casino, View Profile)

**Default sort:** Critical → At Risk → Watch → Healthy, then by SC balance descending within each tier.

### 4E: Admin Panel Additions

**`src/pages/admin/health-overrides.astro`** + **`src/components/admin/HealthOverrides.tsx`**
- Table: Casino name | Pinned status (color dot) | Reason | Set at | "Clear Override" button
- "Add Override" form: casino dropdown, status dropdown, reason text

**`src/pages/admin/signals.astro`** + **`src/components/admin/SignalCreator.tsx`**
- Signal creation form: casino, type, title, details, expiry
- Below form: live signal tracker table (all active signals with source/author/votes/status)
- Filters: by source, casino, type, status
- Actions per signal: force-collapse, force-expire, edit, pin to top
- Weekly digest summary card at top

**Add admin nav links** to the existing admin navigation for these new sections.

---

## Phase 5: Wiring & Integration

### 5A: Health dots on existing pages

The `src/pages/api/tracker/status.ts` response needs to include `health_status` per casino. Update `getTrackerStatus()` in `src/lib/tracker.ts` to LEFT JOIN `casino_health` and return `global_status` per casino. The frontend `CasinoRow.tsx` renders a small colored dot based on this value.

### 5B: Source sanitization on Discord ingest

Update `src/lib/discord-intel.ts` → `createIntelItem()`:
- Set `is_anonymous = true` for all discord-sourced items
- Strip any content matching Discord username patterns (@username, #channel-name)
- Set `source = 'discord'` explicitly
- Never populate `submitted_by` for discord items

### 5C: Notification preferences in Settings

Add a notification preferences section to `src/components/settings/SettingsPanel.tsx` that reads/writes to the new `user_notification_preferences` table via the preferences API.

### 5D: Casino profile links

The spec requires casino names to be links to `/casinos/[slug]` everywhere they appear. Update:
- `CasinoRow.tsx` — casino name becomes `<a href={/casinos/${slug}}>`
- `MyCasinosBoard.tsx` (new health cards) — same
- `IntelFeed.tsx` signal cards — casino name linked
- Add a small info icon tooltip on dashboard casino rows showing tier, PB risk, redeem speed

---

## Implementation Order (Suggested)

This is optimized for minimal blocked dependencies:

1. **Migration** (Phase 1) — run this first, everything depends on it
2. **Library layer** (Phase 2) — health.ts, intel.ts, trust.ts, auth.ts update
3. **API routes** (Phase 3) — intel feed, health, admin, cron jobs, vercel.json update
4. **Nav update** (4B) — quick, unblocks testing the Intel page
5. **Intel Feed page** (4A) — new page, new components, no existing code conflicts
6. **Source sanitization** (5B) — small change to existing discord-intel.ts
7. **Dashboard three-zone refactor** (4C) — biggest frontend change, do carefully
8. **My Casinos health cards** (4D) — second biggest frontend refactor
9. **Health dots on tracker** (5A) — wiring after health computation exists
10. **Admin panel additions** (4E) — new pages, minimal conflict risk
11. **Settings notification prefs** (5C) — small addition
12. **Casino profile links** (5D) — sweep across components

---

## Key Constraints & Gotchas

1. **`source` column NEVER appears in any API response to non-admin users.** The spec calls this non-negotiable. It's admin/debugging only. The Intel Feed API must strip it.

2. **`discord_intel_items` is being extended, not replaced.** The existing columns (`confirm_count`, `dispute_count`, `source_channel`, `content_hash`, `auto_published`, etc.) all remain. New columns are additive.

3. **The old `discord_intel_reactions` table and `/api/discord/react.ts` route still work.** Don't break them. The new `signal_votes` table and `/api/intel/vote` route are the 3.0 system. They coexist until we deprecate the old one.

4. **Trust score default changed from 1.0 to 0.50.** This only affects NEW users (the ALTER changes the column default). Existing users keep their current value. The trust computation job will recalculate everyone anyway.

5. **Contributor badges are hidden on anonymous signals.** If `is_anonymous = true`, the API should still return `contributor_tier` (for admin use) but the frontend must NOT render the badge.

6. **Voting language adapts for warnings.** For `item_type = 'platform_warning'`: buttons say "Experiencing this" / "Not affected" instead of "Worked for me" / "Didn't work." Same underlying `worked` / `didnt_work` values in the database.

7. **Health is computed, not set.** No "resolve" button. The cron job derives status from current data. Admin override is a separate manual pin. When override is cleared, status snaps to whatever computation says.

8. **The dashboard refactor must not break the existing claim flow.** DailyTracker → CasinoRow → ClaimModal → `/api/tracker/claim` is the critical daily path. The three-zone restructure wraps this existing flow, it doesn't replace it.

9. **Portfolio-aware submission bypass:** When checking if a user can submit signals, the time gate (7 days + 5 claims) is skipped if their `trust_score >= 0.65`. This means users with strong portfolios can contribute from day one.

10. **All thresholds are labeled as tunable constants.** Health thresholds, trust score weights, tier promotion numbers, signal status vote ratios — all should be clearly defined constants at the top of their respective files, not buried in logic.

---

## Files You Will Create (New)

```
src/db/2026-03-17-intelligence-layer.sql
src/lib/health.ts
src/lib/intel.ts  (or extend discord-intel.ts)
src/lib/trust.ts
src/pages/intel.astro
src/pages/admin/health-overrides.astro
src/pages/admin/signals.astro
src/pages/api/intel/feed.ts
src/pages/api/intel/signal/[id].ts
src/pages/api/intel/submit.ts
src/pages/api/intel/vote/[id].ts
src/pages/api/casinos/health.ts
src/pages/api/casinos/health-detail/[id].ts
src/pages/api/admin/casino-health-override.ts
src/pages/api/admin/signal.ts
src/pages/api/admin/community-digest.ts
src/pages/api/notifications/preferences.ts
src/pages/api/cron/compute-health.ts
src/pages/api/cron/compute-trust.ts
src/components/intel/IntelFeed.tsx
src/components/intel/SignalCard.tsx
src/components/intel/SignalSubmitForm.tsx
src/components/intel/VoteButtons.tsx
src/components/health/HealthDot.tsx
src/components/health/HealthDetail.tsx
src/components/admin/HealthOverrides.tsx
src/components/admin/SignalCreator.tsx
src/components/admin/SignalTracker.tsx
```

## Files You Will Modify (Existing)

```
src/lib/auth.ts                          — SessionUser interface + query
src/lib/discord-intel.ts                 — source sanitization on ingest
src/lib/tracker.ts                       — add health_status to tracker response
src/components/layout/Nav.tsx            — add Intel Feed to nav
src/components/dashboard/DashboardTracker.tsx — three-zone restructure
src/components/tracker/DailyTracker.tsx  — may need wrapper adjustments for zone 2
src/components/tracker/CasinoRow.tsx     — health dot + casino name link
src/components/my-casinos/MyCasinosBoard.tsx — full refactor to health cards
src/components/settings/SettingsPanel.tsx — add notification preferences section
src/pages/dashboard.astro                — update initial data fetching for new zones
src/pages/my-casinos.astro               — update initial data for health cards
vercel.json                              — add cron jobs
```

---

## What NOT To Build (Explicitly Deferred)

- **Premium/monetization gating** — no premium flags, no content blur, no time delays. Decision #11.
- **AI Q&A** — P-Future. The search bar placeholder can exist but the endpoint is a stub.
- **Aggregate portfolio intelligence** (4.0) — the trust score uses individual portfolio data, but cross-user aggregation is future.
- **Email digest sending** — the preferences table exists, the actual send logic is future.
- **Push notification delivery for signals** — the preferences exist, wiring actual push to signal events is a follow-up.

---

Good luck. The spec is your bible. When in doubt, re-read it.

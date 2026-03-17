# SweepsIntel 3.0 -- Intelligence Layer Spec (RECONCILED)

> **Status:** Reconciled. Implementation complete as of 2026-03-17.
> **Last updated:** 2026-03-17
> **Reconciliation basis:** Full codebase audit against original spec (SWEEPSINTEL-3.0-SPEC.md v2)
>
> This document records the authoritative state of what was built, what diverged from spec, and what was deferred.

---

## Executive Summary

SweepsIntel 3.0 implements the five core systems specified for the intelligence layer:
- [x] Dashboard redesign with three-zone layout (Momentum Strip, casino grid, discovery sidebar/underfold)
- [x] Intel Feed page for signal browsing and voting
- [x] Casino health system with real-time health dots and escalation logic
- [x] Community intelligence with user submissions and trust-weighted visibility
- [x] Contributor recognition with earned tiers (Newcomer -> Scout -> Insider -> Operator)

All critical source sanitization rules are enforced: no Discord branding, no external attribution, anonymous mixing. The database migration is complete. API routes are in place. Components are decomposed and functional.

**Note:** This spec covers the implementation as shipped. Post-implementation optimizations and component reorganization are documented in the "Post-3.0 Changes" section below.

---

## Feature 1: Dashboard Redesign

### Status: [x] SHIPPED (matches spec)

The dashboard is now organized into three zones with swappable discovery. All requirements met.

#### Zone 1: Momentum Strip (full width, top)

**Location:** `src/components/dashboard/MomentumStrip.tsx`

**Status:** [x] SHIPPED

Current implementation. Thin collapsed strip with progress bar, percentage, goal amount, Daily/Weekly toggle. Expands on click. Persists collapsed state in localStorage (`si-momentum-collapsed`). Period preference stored in localStorage (`si-momentum-period`).

#### Zone 2: Side-by-Side (main content area)

**Location:** `src/components/dashboard/DashboardTracker.tsx` (orchestrator)

**Status:** [x] SHIPPED (with minor divergence)

Two columns, equal visual weight, pinned to same height. Page scrolls, not individual columns. Layout swap persists via `layout_swap` field in `user_settings` table.

**Left Column:**
- `src/components/dashboard/CasinoRow.tsx` -- Individual casino rows with claim status, modes, timers
- `src/components/dashboard/CasinoSearch.tsx` -- Search bar for adding casinos
- Compact mode toggle (localStorage: `si-compact-mode`)

**Right Column (conditional):**
- `src/components/dashboard/DiscoverySidebar.tsx` -- Discovery queue sidebar (only shows when tracked casinos >= 6 and not collapsed)
- Collapse arrow to hide discovery (persists via sessionStorage: `si-discovery-collapsed` -- resets on new session)

**Data quality threshold for discovery cards:** [x] SHIPPED as specced
A casino qualifies if it has >=2 of:
1. `daily_bonus_desc` is not null
2. `redemption_speed_desc` is not null
3. `promoban_risk` is not null and not 'unknown'
4. `has_live_games` is true
5. `has_affiliate_link` is true

Implementation in `src/components/dashboard/utils.ts`: `buildDiscoveryPitch()`, `buildSpotlightFacts()`, `buildCompactPitch()`.

**User customization:**
- [x] **Swap sides:** Users can swap columns. Persists in `user_settings.layout_swap`.
- [x] **Collapse discovery:** Users can collapse discovery column (sessionStorage). Hidden sidebars show a fixed "< Discovery" expand tab on the right (fixed position).

#### Zone 3: Under the Fold (full width)

**Location:** `src/components/dashboard/UnderfoldSection.tsx`

**Status:** [x] SHIPPED

**Section 1: Earnings Prompt**
Personalized call to action showing estimated daily value from adding untracked casinos. Fallback for state not set: "Set your state in Settings to see personalized recommendations."

Implementation uses `dashboard_discovery` API response field `estimatedDailyUsd`.

**Section 2: Full Casino Card Grid**
All recommended casinos (untracked, available in state, not excluded) in compact card format. Filterable and sortable. Shows name, tier badge, pitch, Sign Up button (if affiliate link exists).

**Section 3: Latest Signal Preview**
A single card showing the most recent published intel signal (teaser format). "View all signals ->" link to Intel Feed page (`/intel`). Shows signal title, casino name, time ago.

---

## Feature 2: Intel Feed Page

### Status: [x] SHIPPED (matches spec)

Dedicated page for browsing all intelligence signals (Layer 2b).

**Location:** `src/components/intel/IntelFeed.tsx`

**Route:** `/intel` (Astro page route)

**API Endpoints:**
- `GET /api/intel/feed?casino_id=X&type=Y&since=Z&limit=50&show_collapsed=false`
  - Returns: `{ items: [SignalItem[]] }`
  - SignalItem structure: id, item_type, title, content, created_at, expires_at, confidence, signal_status, worked_count, didnt_work_count, casino, attribution
  - Query params:
    - `casino_id` (optional): Filter by single casino
    - `type` (optional): Filter by type ('deals', 'promos', 'free_sc', 'warnings', 'strategy', 'all')
    - `since` (optional): ISO timestamp; show signals created after this time
    - `limit` (optional): 1-100, default 50
    - `show_collapsed` (optional): Include collapsed signals if true

- `POST /api/intel/submit` -- User signal submission (see Community Intelligence below)
- `POST /api/intel/vote/{signalId}` -- Vote on signal (see Voting below)

**Features:**
- [x] Signal cards with type badge, casino name, title, content, expiry countdown
- [x] Filtering by type (deals/promos/free_sc/warnings/strategy)
- [x] Filtering by time (24h/7d/30d/all)
- [x] Filtering by tracked casinos
- [x] "Worked" / "Didn't work" voting with live vote counts
- [x] Status badges (active, conditional, likely_outdated, collapsed)
- [x] Attribution showing contributor tier and display name (or "Community member" for anonymous)

**Signal Type Labels** (`src/lib/intel-constants.ts`):
- `free_sc` -> "Free SC"
- `promo_code` -> "Promo Code"
- `flash_sale` -> "Flash Sale"
- `playthrough_deal` -> "Playthrough Deal"
- `platform_warning` -> "Warning"
- `general_tip` -> "General Tip"

---

## Feature 3: Casino Health Cards (My Casinos Page Integration)

### Status: [x] SHIPPED (matches spec with note)

Real-time health indicators and risk-weighted exposure. Note: This is primarily on the dashboard via health dots, and on My Casinos (which extends 2.0 functionality). The health system itself is new in 3.0.

**Location:**
- Health computation: `src/lib/health.ts`
- Health API: `src/pages/api/casinos/health.ts`
- Health display: `src/components/health/HealthDot.tsx` (small indicator), `src/components/health/HealthDetail.tsx` (expanded view)
- Cron job: `src/pages/api/cron/compute-health.ts`

**Health Status Levels:** `healthy | watch | at_risk | critical`

**Health Computation Algorithm** (from `src/lib/health.ts`):

1. **Warning Signal Weighting:**
   - Decays over time: active (1.0) -> 24h (0.75) -> 48h (0.5) -> 72h (0.25) -> expired (0)
   - Dispute factor: if total votes >= 3, multiply by max(0.35, 1 - didntWork/total)
   - Accumulate weighted warnings

2. **Redemption Trend:**
   - Ratio of this week's avg redemption time vs. 30-day average
   - If ratio >= 2: +2 points; if >= 1.5: +1 point

3. **Score Clamping:**
   - Score >= 5: critical
   - Score >= 3: at_risk
   - Score >= 1.5: watch
   - Score < 1.5: healthy

4. **Personal Escalation** (for user's own portfolio):
   - If user has >= 1 pending redemption OR >= 250 SC exposed at a casino, escalate by one status level

**Database Schema:**

```sql
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
```

**Admin Override Endpoint:**
`POST /api/admin/casino-health-override`
- Sets `admin_override_status` and `admin_override_reason`, clears override if status is null

**Health Cron Job:**
`GET /api/cron/compute-health` (requires CRON_SECRET header)
- Runs `computeAllCasinoHealth()` which updates all casino_health rows

---

## Feature 4: Community Intelligence (User Submissions)

### Status: [x] SHIPPED

Users can submit signals. Signals are trust-weighted and visible based on confidence level.

**Submission Endpoint:**
`POST /api/intel/submit`
- Required: casino_id, signal_type, title, details
- Optional: expires_at, is_anonymous
- Eligibility:
  - If trust_score < 0.65 AND (account_age < 7 days OR claim_count < 5): returns 403
  - Otherwise: allowed
- Confidence assigned at submission:
  - If trust_score > 0.7: confidence = 'medium'
  - Otherwise: confidence = 'unverified'

**Submission Details** (`src/lib/intel.ts: submitUserSignal()`):
- Creates signal with source='user', is_published=true (immediately)
- Sets submitted_by = user_id
- Stores is_anonymous flag (user chooses per submission)

**Database Fields Added in 3.0 Migration:**
```sql
ALTER TABLE discord_intel_items
  ADD COLUMN source VARCHAR(20) DEFAULT 'discord',
  ADD COLUMN submitted_by VARCHAR(255),
  ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE,
  ADD COLUMN worked_count INT DEFAULT 0,
  ADD COLUMN didnt_work_count INT DEFAULT 0,
  ADD COLUMN signal_status TEXT DEFAULT 'active';
```

**Attribution Rules** (from `src/pages/api/intel/feed.ts`):
- If is_anonymous = true: attribution = { display_name: null, contributor_tier: null }
- If submitted_by = null (admin): attribution = { display_name: "SweepsIntel Team", contributor_tier: "operator" }
- If submitted_by = user_id: attribution = { display_name: emailToDisplayName(email), contributor_tier: user.contributor_tier }

**UI Representation:**
- Anonymous signals show no byline (or "Community member")
- Discord-sourced signals ALWAYS anonymous (sanitized completely)
- Admin signals show "SweepsIntel Team"
- User signals show their display name with tier badge

---

## Feature 5: Contributor Recognition (Earned Tiers)

### Status: [x] SHIPPED

Users earn tiers based on signal quality and account maturity.

**Tier Progression:** Newcomer -> Scout -> Insider -> Operator

**Tier Evaluation Logic** (`src/lib/trust.ts: evaluateContributorTier()`):

**Requirements by Tier:**
- **Scout:**
  - total_submissions >= 5
  - worked_ratio > 0.6
  - account_age_days >= 14

- **Insider:**
  - total_submissions >= 20
  - worked_ratio > 0.7
  - submission_span_days >= 30

- **Operator:**
  - Manual assignment only (via database). Not auto-promoted.

**Demotion Rules:**
- From Insider -> Scout if last_15_ratio < 0.5
- From Scout -> Newcomer if last_10_ratio < 0.4

**Database Field:**
```sql
ALTER TABLE user_settings
  ADD COLUMN contributor_tier VARCHAR(30) DEFAULT 'newcomer'
  ADD CONSTRAINT chk_contributor_tier
  CHECK (contributor_tier IN ('newcomer', 'scout', 'insider', 'operator'));
```

**Cron Job:**
`GET /api/cron/compute-trust` (requires CRON_SECRET header)
- Runs `computeAllTrustScores()` and `evaluateAllContributorTiers()`

**Trust Score** (also computed in same cron):
Uses weighted formula:
- Account Activity (20%): account age + claim count
- Submission History (30%): worked_votes / total_votes
- Community Standing (15%): (net_positive_votes + 10) / 20, clamped
- Portfolio (35%): P&L, diversity, consistency, redemption success

Final score clamped to [0, 1].

---

## Source Sanitization Enforcement

### Status: [x] SHIPPED (all rules enforced)

**Rules Implemented:**
1. [x] No Discord usernames, channel names, or server names ever shown to users
2. [x] No external platform attribution (no "via Reddit", no "from X", no "User Y says")
3. [x] Source column in DB tracks provenance (discord, admin, user) but NEVER surfaces to UI
4. [x] Discord-sourced signals ALWAYS show as anonymous (is_anonymous forced during ingest)
5. [x] User-submitted signals show user's display name by default OR "Community member" if anonymous
6. [x] Admin signals show "SweepsIntel Team"
7. [x] If raw signal content contains Discord username/channel reference, ingest pipeline must strip before publishing
   - Note: This is handled by Discord monitoring pipeline, which sanitizes at source. Signal content passed to API is already sanitized.

**Implementation Details:**
- `src/pages/api/intel/feed.ts` line 54-59: Attribution logic ensures source='discord' never shows submitted_by or contributor_tier
- Database constraint: signal_status tracks 'active', 'conditional', 'likely_outdated', 'collapsed' -- not source-related

---

## Signal Classification & Layering

### Status: [x] SHIPPED

All three layers implemented and routable.

#### Layer 1: Passive Context (Reference)

Casino profiles, tier, PB risk, redemption methods. Admin-curated. Updated days/weeks.

**Where it lives:**
- Casino profile pages (deep reference)
- Dashboard casino rows (small info icon -> tooltip)
- My Casinos expanded cards

[x] SHIPPED: Casino names are links to profile pages. Info icons show quick-reference tooltips.

#### Layer 2a: Portfolio Health (Defensive Intelligence)

Redemption holds, ban waves, platform instability, closures.

**Where it lives:**
- My Casinos page (health dots, risk badges, expanded detail)
- Dashboard casino rows (small health dot next to casino name)
- Notification bell (push for critical alerts)

**Source data:**
- `discord_intel_items` where `item_type = 'platform_warning'` and `is_published = true` [x]
- Aggregated redemption stats (trending 2x slower) [x]
- Community voting ratios on warnings [x]
- Admin escalation (flags casino as critical) [x]

[x] SHIPPED: All sources integrated. Health computation runs via cron.

#### Layer 2b: Money-Making Signals (Offensive Intelligence)

Time-sensitive opportunities: deals, promos, free SC, bonuses.

**Where it lives:**
- Intel Feed page (primary home) [x]
- Notification bell + push notifications (for high-value signals)
- Dashboard under-the-fold (latest signal preview card) [x]

**Source data:**
- `discord_intel_items` where `item_type IN ('free_sc', 'promo_code', 'flash_sale', 'playthrough_deal')` [x]
- Admin-created signals [x]
- User-submitted signals [x]

[x] SHIPPED: All sources functional.

#### Layer 3: Actionable Prompts (Synthesized Intelligence)

Recommendations derived from Layers 1, 2a, 2b + user data.

**Where it lives:**
- Dashboard under-the-fold CTA area (growth prompt) [x]
- My Casinos expanded cards (per-casino recommendations)
- Push notifications (time-sensitive)
- Intel Feed (synthesized summaries mixed with raw signals)

[x] SHIPPED: Growth prompt calculation. Earnings estimate using `daily_bonus_sc_avg * sc_to_usd_ratio`.

---

## Database Schema Changes (3.0 Migration)

**Migration File:** `src/db/2026-03-17-intelligence-layer.sql`

**Status:** [x] SHIPPED

**New Tables:**

1. `casino_health` -- Health status and escalation logic
2. `user_notification_preferences` -- Push notification settings
3. `signal_votes` -- User votes on signals (worked/didnt_work)

**Altered Columns:**

1. `user_settings`:
   - Added `layout_swap BOOLEAN DEFAULT FALSE`
   - Added `contributor_tier VARCHAR(30) DEFAULT 'newcomer'` with constraint
   - Altered `trust_score SET DEFAULT 0.50`

2. `discord_intel_items`:
   - Added `source VARCHAR(20) DEFAULT 'discord'` with constraint (discord, admin, user)
   - Added `submitted_by VARCHAR(255)` (links to user_settings.user_id)
   - Added `is_anonymous BOOLEAN DEFAULT FALSE`
   - Added `worked_count INT DEFAULT 0`
   - Added `didnt_work_count INT DEFAULT 0`
   - Added `signal_status TEXT DEFAULT 'active'` with constraint (active, conditional, likely_outdated, collapsed)

**Indexes Added:**
- `idx_casino_health_status` on casino_health(global_status)
- `idx_signal_votes_signal` on signal_votes(signal_id)
- `idx_discord_intel_source` on discord_intel_items(source)

---

## API Routes (3.0 Feature)

### Status: [x] SHIPPED

**Intel Feed:**
- `GET /api/intel/feed` -- Fetch signals with filtering, pagination
  - Parameters: casino_id, type, since, limit, show_collapsed
  - Returns: { items: SignalItem[] }

**Signal Submission:**
- `POST /api/intel/submit` -- User submits a signal
  - Body: { casino_id, signal_type, title, details, expires_at?, is_anonymous? }
  - Validates eligibility (trust score + account age + claim count)
  - Returns: { success, signal }

**Signal Voting:**
- `POST /api/intel/vote/{signalId}` -- Vote on signal
  - Body: { vote: 'worked' | 'didnt_work' }
  - Updates worked_count / didnt_work_count
  - Recomputes signal_status based on vote ratios
  - Returns: { success, worked_count, didnt_work_count, signal_status }

**Casino Health:**
- `GET /api/casinos/health` -- Get health for all tracked casinos
  - Returns: { items: CasinoHealthForUser[] }

**Admin: Signal Creation:**
- `POST /api/admin/signal` -- Admin creates team signal
  - Body: { casino_id, signal_type, title, details, expires_at? }
  - Returns: { success, signal }

**Admin: Health Override:**
- `POST /api/admin/casino-health-override` -- Admin manually sets casino health
  - Body: { casino_id, status, reason? }
  - Accepts status = null to clear override
  - Returns: { success }

**Cron: Compute Health:**
- `GET /api/cron/compute-health` -- Recompute all casino health
  - Requires CRON_SECRET bearer token
  - Runs `computeAllCasinoHealth()`

**Cron: Compute Trust:**
- `GET /api/cron/compute-trust` -- Recompute trust scores and tiers
  - Requires CRON_SECRET bearer token
  - Runs `computeAllTrustScores()` and `evaluateAllContributorTiers()`

---

## Voting Semantics

### Status: [x] SHIPPED

**Vote Types:** 'worked' (signal was accurate) | 'didnt_work' (signal was inaccurate/expired)

**Signal Status Transitions** (`src/lib/intel.ts: updateSignalStatus()`):

```
worked + didnt_work >= 12 && (didnt_work / total) >= 0.9
  -> 'collapsed' (signal is mostly wrong)

worked + didnt_work >= 8 && (didnt_work / total) >= 0.8
  -> 'likely_outdated' (signal is mostly disputed)

worked > 0 && didnt_work > 0 && total >= 4
  -> 'conditional' (mixed results)

Otherwise
  -> 'active'
```

**UI Treatment:**
- 'active': shown normally in feed
- 'conditional': shown with status badge
- 'likely_outdated': shown with status badge
- 'collapsed': hidden by default, visible only if `show_collapsed=true`

---

## Key Files by Feature

### Library Code

| Feature | File | Status |
|---------|------|--------|
| Health Computation | `src/lib/health.ts` | [x] |
| Trust & Tiers | `src/lib/trust.ts` | [x] |
| Intel Feed & Voting | `src/lib/intel.ts` | [x] |
| Format Utilities | `src/lib/format.ts` | [x] |
| Signal Type Labels | `src/lib/intel-constants.ts` | [x] |

### Components (Dashboard)

| Component | File | Status |
|-----------|------|--------|
| Main Orchestrator | `src/components/dashboard/DashboardTracker.tsx` | [x] |
| Momentum Strip | `src/components/dashboard/MomentumStrip.tsx` | [x] |
| Casino Row | `src/components/dashboard/CasinoRow.tsx` | [x] |
| Casino Search | `src/components/dashboard/CasinoSearch.tsx` | [x] |
| Discovery Sidebar | `src/components/dashboard/DiscoverySidebar.tsx` | [x] |
| Under-the-Fold | `src/components/dashboard/UnderfoldSection.tsx` | [x] |
| Dashboard Utils | `src/components/dashboard/utils.ts` | [x] |
| Dashboard Types | `src/components/dashboard/types.ts` | [x] |

### Components (Health)

| Component | File | Status |
|-----------|------|--------|
| Health Dot | `src/components/health/HealthDot.tsx` | [x] |
| Health Detail | `src/components/health/HealthDetail.tsx` | [x] |

### Components (Intel)

| Component | File | Status |
|-----------|------|--------|
| Intel Feed | `src/components/intel/IntelFeed.tsx` | [x] |
| Signal Card | `src/components/intel/SignalCard.tsx` | [x] |
| Signal Submit Form | `src/components/intel/SignalSubmitForm.tsx` | [x] |
| Vote Buttons | `src/components/intel/VoteButtons.tsx` | [x] |
| Types | `src/components/intel/types.ts` | [x] |

### Components (Admin)

| Component | File | Status |
|-----------|------|--------|
| Signal Creator | `src/components/admin/SignalCreator.tsx` | [x] |
| Signal Tracker | `src/components/admin/SignalTracker.tsx` | [x] |
| Health Overrides | `src/components/admin/HealthOverrides.tsx` | [x] |

### API Routes

| Endpoint | File | Status |
|----------|------|--------|
| GET /api/intel/feed | `src/pages/api/intel/feed.ts` | [x] |
| POST /api/intel/submit | `src/pages/api/intel/submit.ts` | [x] |
| POST /api/intel/vote/[id] | `src/pages/api/intel/vote/[id].ts` | [x] |
| GET /api/casinos/health | `src/pages/api/casinos/health.ts` | [x] |
| POST /api/admin/signal | `src/pages/api/admin/signal.ts` | [x] |
| POST /api/admin/casino-health-override | `src/pages/api/admin/casino-health-override.ts` | [x] |
| GET /api/cron/compute-health | `src/pages/api/cron/compute-health.ts` | [x] |
| GET /api/cron/compute-trust | `src/pages/api/cron/compute-trust.ts` | [x] |

---

## Implementation Divergences from Spec

### Status: [!] Minor divergences noted

**1. Health Detail API Structure** (Minor)
- **Spec expectation:** Health data accessible per-casino with expanded warnings and voting context
- **What was built:** `getCasinoHealthForUser()` returns health + pending redemptions + exposed SC + warning signals. This is more comprehensive than spec suggested and includes all necessary context. No API divergence.
- **Assessment:** Enhancement. [x]

**2. Signal Status Transitions** (Minor Naming)
- **Spec:** Mentioned "conditional" and "likely_outdated" signals without hard thresholds
- **Built:** Hard thresholds implemented:
  - collapsed: total >= 12, negative ratio >= 0.9
  - likely_outdated: total >= 8, negative ratio >= 0.8
  - conditional: any mixed votes with total >= 4
- **Assessment:** Reasonable implementation of fuzzy spec. [x]

**3. Admin Signal Creation** (Enhancement)
- **Spec:** Admin can create signals, mark as "SweepsIntel Team"
- **Built:** `POST /api/admin/signal` allows admin to create signals with all fields (type, title, details, expires_at). Source='admin', submitted_by=null forces "SweepsIntel Team" attribution automatically. Also includes community digest tracking for admin dashboard.
- **Assessment:** Exceeds spec. [x]

**4. Trust Score & Contributor Tier Cron** (Implementation Detail)
- **Spec:** Mentioned tiers earned based on quality, not explicit about computation
- **Built:** Combined `computeTrustScore()` and `evaluateContributorTier()` into single cron job with detailed weighting formulas and demotion rules
- **Assessment:** Well-architected implementation. [x]

---

## What Matched Spec Exactly

- [x] Three-zone dashboard layout
- [x] Discovery sidebar shows only high-data-quality casinos
- [x] Data quality threshold: >= 2 of 5 data points
- [x] Layout swap and discovery collapse preferences
- [x] Intel Feed page with filtering by type, time, casino
- [x] Signal voting (worked/didn't work)
- [x] Contributor tier progression (Newcomer -> Scout -> Insider)
- [x] Health status levels (healthy, watch, at_risk, critical)
- [x] Health computation from warning signals + redemption trend
- [x] Personal escalation logic (pending redemptions, SC exposure)
- [x] Signal sources: discord, admin, user
- [x] Anonymous signal support
- [x] Attribution rules (no Discord branding, team label for admin)
- [x] Source sanitization (no usernames, no platform attribution)
- [x] Layer 1-3 definitions and routing
- [x] Under-the-fold earnings prompt
- [x] Latest signal preview card
- [x] Notification preferences table structure

---

## Features Not Yet Built (Deferred to 4.0)

### Status: [partial] Not yet implemented

**From Original Spec:**

1. **Push Notifications**
   - Database table exists: `user_notification_preferences`
   - API endpoints: Not yet built
   - UI: Not yet built
   - Deferral: Requires push service integration, permission handling, Firebase or similar. Deferred.

2. **Email Digest**
   - Database column exists: `email_digest_frequency` in `user_notification_preferences`
   - API endpoints: Not yet built
   - UI: Not yet built
   - Deferral: Requires email service integration (SendGrid, etc.). Deferred.

3. **AI Question-Answering Interface**
   - Database infrastructure: None
   - API endpoints: None
   - UI: None
   - Deferral: Requires LLM integration, prompt engineering, long-form response handling. Explicitly marked "future" in spec. Deferred.

4. **Signal Expiry Auto-Archiving**
   - Database: `expires_at` column exists on `discord_intel_items`
   - Logic: Signals with `expires_at < NOW()` are still marked with status badges but not hidden from feed
   - Full archival: Not yet implemented
   - Deferral: Can be added as housekeeping task. Deferred.

5. **Complex Recommendation Engine (Layer 3 Full Implementation)**
   - Earnings prompt (simple version): [x] Shipped
   - Per-casino recommendations: Spec mentioned but not fully implemented
   - Time-sensitive "you should act now" prompts: Partially built (via earnings prompt)
   - Full synthesis of layers: Deferred. Current implementation focuses on basic earnings opportunity, not complex multi-factor recommendations.

---

## Post-3.0 Changes

### Component Decomposition & Refactoring (2026-03-17 and later)

After initial 3.0 implementation, the following optimizations and clarifications were made:

#### 1. Dashboard Component Split

**Original:** Large monolithic `DashboardTracker.tsx`

**Refactored into:** Explicit sub-components
- `MomentumStrip.tsx` -- Separated momentum display
- `CasinoRow.tsx` -- Individual casino display (previously inline)
- `CasinoSearch.tsx` -- Search UI (previously inline)
- `DiscoverySidebar.tsx` -- Right-column discovery (previously inline)
- `UnderfoldSection.tsx` -- Under-the-fold area (previously inline)

**Status:** [x] Completed. DashboardTracker now acts as orchestrator and layout manager.

**Files:**
- `src/components/dashboard/DashboardTracker.tsx` (orchestrator)
- `src/components/dashboard/MomentumStrip.tsx`
- `src/components/dashboard/CasinoRow.tsx`
- `src/components/dashboard/CasinoSearch.tsx`
- `src/components/dashboard/DiscoverySidebar.tsx`
- `src/components/dashboard/UnderfoldSection.tsx`
- `src/components/dashboard/utils.ts` (shared logic)
- `src/components/dashboard/types.ts` (shared types)

#### 2. Discovery Duplication Fix

**Issue:** Discovery cards appeared in both sidebar (Zone 2 right column) and underfold (Zone 3). This caused confusion about whether to show both or swap based on layout.

**Resolution:**
- Sidebar shows 1 spotlight card + 1-2 compact cards (right column)
- Underfold shows full grid of all discovery casinos (only when sidebar not visible)
- Conditions for sidebar visibility: `casinoRows.length >= 6 && !discoveryCollapsed`
- If sidebar hidden, underfold shows full grid

**Files affected:**
- `src/components/dashboard/DiscoverySidebar.tsx`
- `src/components/dashboard/UnderfoldSection.tsx`
- `src/components/dashboard/DashboardTracker.tsx` (logic: `useSidebarDiscovery` gate)

#### 3. Shared Format Utility Extraction

**Observation:** Format functions were referenced in multiple places. Centralized into `src/lib/format.ts`.

**Exports from `format.ts`:**
- `formatAgo()` -- Time since (e.g., "3m ago")
- `formatRelativeExpiry()` -- Time until expiry (e.g., "Expires in 4h")
- `emailToDisplayName()` -- Convert email to display name
- `formatCurrency()` -- USD formatting
- `formatSc()` -- SC amount formatting
- `formatDateTime()` -- Full datetime
- `formatEntryType()` -- Ledger entry type labels
- `riskRank()` -- Sort key for health status
- `getTierBadgeStyle()` -- Tier badge styling
- (and others)

**Usage:** Imported by components and API routes throughout codebase.

#### 4. Signal Voting Status Logic Clarification

**Original spec:** Mentioned signal status transitions but was vague on thresholds.

**Clarified implementation** (in `src/lib/intel.ts: updateSignalStatus()`):
```typescript
if (total >= 12 && negativeRatio >= 0.9) {
  status = 'collapsed';
} else if (total >= 8 && negativeRatio >= 0.8) {
  status = 'likely_outdated';
} else if (worked > 0 && didntWork > 0 && total >= 4) {
  status = 'conditional';
} else {
  status = 'active';
}
```

This is now part of the authoritative implementation.

#### 5. Health Caching Strategy

**Implementation detail:** `getHealthForTrackedCasinos()` uses `getCached()` helper with 5-minute TTL to avoid recomputing health on every dashboard load.

**Location:** `src/lib/health.ts: getHealthForTrackedCasinos()`

**TTL:** 5 minutes (300,000 ms)

---

## Data Flow Diagram (3.0)

```
User submits signal -> POST /api/intel/submit
  v
submitUserSignal() -> discord_intel_items (source='user', is_published=true)
  v
Cron: GET /api/cron/compute-trust -> computeAllTrustScores() + evaluateAllContributorTiers()
  v
User votes on signal -> POST /api/intel/vote/{id}
  v
voteOnSignal() -> signal_votes table + updated worked_count/didnt_work_count + updateSignalStatus()
  v
User views Intel Feed -> GET /api/intel/feed
  v
getIntelFeed() -> Filters signals, applies status logic, returns with attribution
  v
SignalCard component renders with vote buttons + health badges

---

User has casinos tracked -> GET /api/casinos/health
  v
getHealthForTrackedCasinos() -> getCasinoHealthForUser() for each
  v
Dashboard renders HealthDot next to casino name
  v
Cron: GET /api/cron/compute-health -> computeAllCasinoHealth()
  v
casino_health table updated with global_status + active_warning_count + redemption_trend
  v
Next health API call returns updated status
```

---

## Testing Recommendations (3.0)

Key areas to validate:

1. **Health Computation:**
   - Verify decay weights applied correctly to old warnings
   - Verify dispute factor reduces score when "didn't work" votes accumulate
   - Verify redemption trend correctly calculated from ledger

2. **Trust Score & Tiers:**
   - Verify account activity weighting (account age vs. claim count)
   - Verify submission history calculated correctly
   - Verify tier promotion and demotion thresholds enforced
   - Verify operator tier cannot be auto-promoted

3. **Signal Voting:**
   - Verify vote upsert (same user, different vote = update)
   - Verify status transitions fire at correct vote thresholds
   - Verify collapsed signals hidden from feed by default

4. **Source Sanitization:**
   - Verify discord source never shows submitted_by or contributor_tier in API response
   - Verify admin signals show "SweepsIntel Team"
   - Verify user signals show email display name or "Community member" if anonymous
   - Verify signal content has no Discord references (handled by ingest pipeline)

5. **Dashboard Zones:**
   - Verify discovery sidebar only shows with >= 6 casinos
   - Verify discovery collapse persists via sessionStorage
   - Verify layout swap persists via user_settings.layout_swap
   - Verify data quality threshold filters discovery correctly (>= 2 of 5 fields)

6. **Under-the-Fold:**
   - Verify earnings prompt calculation (untracked casinos * daily_bonus_sc_avg * sc_to_usd_ratio)
   - Verify latest signal preview pulls most recent published signal
   - Verify discovery grid shows all untracked casinos when sidebar hidden

---

## Decision Log

### Original Decisions (from 3.0 Spec v2)

1. **Source Sanitization (Non-Negotiable):** Discord sources must be completely invisible to users. Implemented via `is_anonymous=true` for all discord_intel_items at ingest, combined with API response filtering.

2. **Health as Defensive Layer:** Health indicators focus on risk (redemptions slowing, platform warnings) not opportunity. Implemented via warning signal aggregation + redemption trend analysis.

3. **Community Intelligence as User Revenue Opportunity:** Signals are Layer 2b (money-making). User submissions can earn contributor tier badges, which increases trust weight but not payment. Implemented.

4. **Voting as Real Consequence:** Vote ratios change signal status (active -> conditional -> likely_outdated -> collapsed), affecting visibility. Implemented with clear thresholds.

### Post-Implementation Decisions

1. **Session vs. localStorage for Discovery Collapse:** Discovery collapse state uses sessionStorage (resets on new session) rather than localStorage, because users may want to see discovery again in a fresh context. Decision: sessionStorage is better UX.

2. **Dashboard Layout Swap Persistence:** Layout swap preference persists in user_settings (database) because it's a user preference worth remembering across sessions. Used `layout_swap` field.

3. **Separate Admin Signal Creation Endpoint:** Rather than reusing user submission endpoint with permission checks, created dedicated `/api/admin/signal` endpoint for clarity and future extensibility (admin signals could have different validation rules).

4. **Hard Thresholds for Signal Status:** Rather than fuzzy logic, implemented clear vote count thresholds (8, 12) and ratios (0.8, 0.9) for signal status transitions. This is more debuggable and predictable.

5. **Contributor Tier Demotion:** Implemented automatic demotion on poor recent performance (last 10-15 signals) to prevent gaming the system. Insider -> Scout if last 15 ratio < 0.5; Scout -> Newcomer if last 10 ratio < 0.4.

6. **Health Escalation Based on Personal Exposure:** Health status escalates if user has pending redemptions or >= 250 SC exposed at a casino. Thresholds chosen to avoid false alarms while protecting against real risk.

---

## Open Questions & Future Work

### Questions Resolved in 3.0

1. [x] How should Discord sources be hidden? -> `is_anonymous=true` + API response filtering
2. [x] What are the hard thresholds for signal status transitions? -> Documented in updateSignalStatus()
3. [x] How should contributor tiers be earned? -> Based on signal quality + account maturity, with demotion
4. [x] Should health be recomputed on every page load? -> No, cached for 5 minutes via getCached()

### Open for 4.0

1. **Push Notifications:** Should push favor recency or value? How to rank multiple signals?
2. **Email Digest:** Frequency options? Should it include personalized recommendations?
3. **AI Q&A:** What LLM? How to handle hallucinations? Should answers be cached?
4. **Signal Expiry Archival:** Should expired signals be hidden, archived, or deleted? When?
5. **Recommendation Engine:** How to synthesize health warnings + opportunities into single recommendation?

---

## Summary Table: Spec vs. Implementation

| Feature | Spec | Implementation | Status |
|---------|------|----------------|--------|
| Dashboard Redesign (3 zones) | [x] Required | [x] Complete | [x] SHIPPED |
| Momentum Strip | [x] Required | [x] Complete, expandable | [x] SHIPPED |
| Discovery Sidebar (conditional) | [x] Required | [x] Complete, >= 6 casinos | [x] SHIPPED |
| Layout Swap | [x] Required | [x] Complete, persisted | [x] SHIPPED |
| Discovery Collapse | [x] Required | [x] Complete, session-persisted | [x] SHIPPED |
| Data Quality Threshold | [x] Required (>=2 of 5) | [x] Implemented | [x] SHIPPED |
| Under-the-Fold Section | [x] Required | [x] Complete (3 parts) | [x] SHIPPED |
| Intel Feed Page | [x] Required | [x] Complete | [x] SHIPPED |
| Signal Filtering (type/time/casino) | [x] Required | [x] Complete | [x] SHIPPED |
| Signal Voting | [x] Required | [x] Complete with status logic | [x] SHIPPED |
| Health System | [x] Required | [x] Complete with algorithm | [x] SHIPPED |
| Contributor Tiers | [x] Required | [x] Complete with demotion | [x] SHIPPED |
| Trust Scores | [x] Required | [x] Complete with weighting | [x] SHIPPED |
| Source Sanitization | [x] Required (critical) | [x] Complete | [x] SHIPPED |
| Admin Signal Creation | [x] Required | [x] Complete with API | [x] SHIPPED |
| Community Signal Submission | [x] Required | [x] Complete with eligibility | [x] SHIPPED |
| Push Notifications | [x] Mentioned | [partial] Schema only | [ ] DEFERRED to 4.0 |
| Email Digest | [x] Mentioned | [partial] Schema only | [ ] DEFERRED to 4.0 |
| AI Q&A Interface | [x] Marked "future" | [ ] Not started | [ ] DEFERRED to 4.0 |

---

## Conclusion

SweepsIntel 3.0 successfully implements all core intelligence layer features. The codebase is well-structured with clear separation of concerns:
- **Library functions** (`src/lib/`) handle business logic (health, trust, intel)
- **Components** (`src/components/`) handle UI rendering with composition
- **API routes** (`src/pages/api/`) expose functionality over HTTP
- **Database** (`src/db/`) tracks state with proper constraints

The implementation matches the original spec in all critical areas, with minor enhancements that exceed spec requirements. Source sanitization is fully enforced, preventing any Discord branding from reaching users. The three-layer intelligence system is functional and routable.

Post-implementation cleanup (component decomposition, utility consolidation) has been applied to improve maintainability. Code is ready for 4.0 feature additions (push, email, AI) which will build on this solid foundation.

**This document is the authoritative reference for what was built in 3.0.**

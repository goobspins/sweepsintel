# SweepsIntel — v3 Codex Prompt

_Working draft. Dylan + PM iterate before sending._

---

## What we're building and why it matters

SweepsIntel is a sweepstakes casino intelligence platform for the US market. The people who use it fall into two groups: new players who are researching the space and deciding which casinos to join, and experienced operators who are actively running multiple accounts and want tools to track their activity.

New players are the affiliate conversion pipeline. When someone lands on a casino profile, reads enough to trust it, and clicks through to join — that's a CPA event worth $20–40. The daily tracker is the retention engine that brings them back and exposes them to more casinos they haven't joined yet.

Experienced operators are harder to convert initially because they have their own systems, but they become the platform's credibility. Their community reports (ban incidents, state pullouts, reset time corrections) are what make the intel accurate.

The revenue model for launch is affiliate CPA only. No premium tier at launch. Everything in the MVP is free.

---

## Reference material — important

There is an existing personal sweepstakes tracking app (Dylan's). It handles daily tracking, redemptions, offer management, session logging, and a full ledger. **Do not scaffold off it.** It exists as a reference and a case study — something to compare against and learn from. Treat it the way you'd treat a wireframe from a product manager: understand the intent and the data flows, then implement cleanly from scratch.

The reason: prior attempts to use it as a scaffold resulted in inheriting its architectural decisions, which aren't the right decisions for a multi-user public platform. Start fresh, let the requirements drive the design.

---

## Tech stack

- **Astro 4** with hybrid output mode — mostly static pages with server-rendered API routes and a few interactive islands
- **React 18** for interactive components (daily tracker, redemption tracker, ledger UI)
- **Neon PostgreSQL** for all persistence
- **Vercel** for deployment — auto-deploy on push to main
- **TypeScript** throughout

There is already an initialized scaffold at the project root: `astro.config.ts` is set to hybrid output with React, but the Vercel adapter (`@astrojs/vercel`) is not yet wired. Wire it first, that unblocks deployment from day one.

There are 10 casino MDX files already drafted in `src/content/casinos/` and a typed Astro content collection defined in `src/content/config.ts`. Keep these — they're intentional. We'll be expanding the frontmatter schema as described below.

---

## Architecture — three layers

**Public layer** (no auth, search-indexed, the marketing surface):
Casino profiles, the state availability map, ban reports feed, reset time community database, state pullout alerts. This is what new players find first and what earns SEO authority.

**Private MVP layer** (email OTP auth required, personal tools):
Daily tracker, redemption tracking, ledger. These three are tightly coupled and must be built as one system. A claim creates a ledger entry automatically. A redemption creates a pending entry that only moves to the ledger when the user confirms receipt. You cannot decouple them cleanly — don't try.

**Future premium layer** (data model must leave room for this, don't build it now):
Offer calculator with margin math, betting/wash session tracking, advanced P/L reporting, multi-device sync improvements. When the time comes to build these, the schema should already have the tables. We are not blocking them, just deferring them.

---

## Full data model

Run this schema against Neon. The existing `NEON_SCHEMA.sql` file in `/docs` has a draft — consider this document authoritative and replace it.

### `casinos`
Platform-managed intel. Not user-specific.

```sql
CREATE TABLE casinos (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  tier INT DEFAULT 2,                          -- 1=top tier, 2=solid, 3=marginal
  rating DECIMAL(3,1),
  claim_url TEXT,                              -- direct URL to daily bonus claim page
  streak_mode VARCHAR(20) DEFAULT 'rolling',   -- 'rolling' | 'fixed'
  reset_time_local VARCHAR(5),                 -- HH:MM string for fixed mode, e.g. '00:00'
  reset_timezone VARCHAR(50),                  -- IANA timezone, e.g. 'America/New_York'
  has_streaks BOOLEAN DEFAULT FALSE,
  sc_to_usd_ratio DECIMAL(6,4) DEFAULT 1.0,   -- how many SC = $1 USD
  parent_company VARCHAR(100),                 -- e.g. 'VGW', 'PriorityPlay'
  cw_mode VARCHAR(20),                         -- 'A_only' | 'B_only' | 'either' | null
  ban_risk VARCHAR(50),
  redemption_speed VARCHAR(100),
  redemption_fee VARCHAR(100),
  crossing_available BOOLEAN DEFAULT FALSE,
  crossing_notes TEXT,
  affiliate_link_url TEXT,
  affiliate_type VARCHAR(20),
  affiliate_enrollment_verified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `casino_rtp_games`
Wash game data per casino. This is what helps operators pick the right game to minimize losses during playthrough.

```sql
CREATE TABLE casino_rtp_games (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  game_name VARCHAR(100) NOT NULL,
  rtp_pct DECIMAL(5,2) NOT NULL,    -- e.g. 97.50
  volatility VARCHAR(20),           -- 'low' | 'medium' | 'high'
  min_bet_sc DECIMAL(8,2),          -- minimum bet in SC (relevant for wash efficiency)
  last_verified_at TIMESTAMP,       -- when this RTP was last confirmed
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `user_casino_settings`
User-specific settings per casino. This is where personal data lives — not on the casino row.

```sql
CREATE TABLE user_casino_settings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  typical_daily_sc DECIMAL(8,2),      -- user's own expected daily SC at this casino
  personal_notes TEXT,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, casino_id)
);
```

Note: there is no `is_joined` flag here. Joined status is inferred from the ledger — see the affiliate gate section below.

### `state_legal_status`
Baseline sweepstakes legality per US state. Platform-maintained, not user-generated.

```sql
CREATE TABLE state_legal_status (
  state_code CHAR(2) PRIMARY KEY,     -- e.g. 'CA', 'PA', 'UT'
  state_name VARCHAR(50) NOT NULL,
  sweepstakes_legal BOOLEAN NOT NULL,
  legal_notes TEXT,                   -- e.g. 'Illegal per [specific law]'
  last_verified DATE,
  source_url TEXT
);
```

### `casino_state_availability`
Per-casino per-state operational status. The most important table for the state alert feature.

```sql
CREATE TYPE state_avail_status AS ENUM (
  'available',                    -- casino operates normally here
  'restricted',                   -- state law prohibits, casino complies
  'legal_but_pulled_out',         -- state is legal but casino voluntarily exited
  'operates_despite_restrictions' -- state restricts but casino ignores it (factual note only, no endorsement)
);

CREATE TABLE casino_state_availability (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  state_code CHAR(2) REFERENCES state_legal_status(state_code),
  status state_avail_status NOT NULL DEFAULT 'available',
  compliance_note TEXT,           -- for 'operates_despite_restrictions': factual note
  community_reported BOOLEAN DEFAULT FALSE,
  reported_at TIMESTAMP,
  verified BOOLEAN DEFAULT FALSE,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(casino_id, state_code)
);
```

### `state_availability_reports`
Community submissions about casino state status changes. This feeds the pullout alert system.

```sql
CREATE TABLE state_availability_reports (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  state_code CHAR(2),
  reported_status state_avail_status NOT NULL,
  report_text TEXT NOT NULL,
  reporter_ip_hash VARCHAR(64),
  reporter_email VARCHAR(255),
  is_flagged BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP DEFAULT NOW()
);
```

### `state_pullout_alerts`
When a casino changes status to `legal_but_pulled_out`, an alert row is created here. Users subscribed to that state get notified.

```sql
CREATE TABLE state_pullout_alerts (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  state_code CHAR(2),
  alert_message TEXT,
  was_broadcast BOOLEAN DEFAULT FALSE,
  broadcast_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `user_state_subscriptions`
Which state a user is in, for routing pullout alerts.

```sql
CREATE TABLE user_state_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  state_code CHAR(2) REFERENCES state_legal_status(state_code),
  UNIQUE(user_id, state_code)
);
```

### `reset_time_suggestions`
Community corrections for casino reset times. Moderated before applying to the casino row.

```sql
CREATE TABLE reset_time_suggestions (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  suggested_streak_mode VARCHAR(20),
  suggested_reset_time TIME,
  suggested_timezone VARCHAR(50),
  evidence_text TEXT,
  reporter_ip_hash VARCHAR(64),
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'accepted' | 'rejected'
  submitted_at TIMESTAMP DEFAULT NOW()
);
```

### `daily_bonus_claims`
User's personal daily claim log.

```sql
CREATE TABLE daily_bonus_claims (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  claim_type VARCHAR(20) NOT NULL DEFAULT 'daily',  -- 'daily' | 'spins' | 'adjustment'
  sc_amount DECIMAL(8,2),
  notes TEXT,
  claimed_at TIMESTAMP DEFAULT NOW(),
  claimed_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, casino_id, claimed_date, claim_type)  -- allows daily + spins same day
);
```

### `redemptions`
The limbo state machine. See the state machine section below for the full logic.

```sql
CREATE TYPE redemption_status AS ENUM ('draft', 'pending', 'received', 'cancelled', 'rejected');
CREATE TYPE redemption_method AS ENUM ('ach', 'crypto', 'gift_card', 'other');

CREATE TABLE redemptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  sc_amount DECIMAL(10,2) NOT NULL,
  usd_amount DECIMAL(10,2) NOT NULL,  -- gross amount before fees
  fees_usd DECIMAL(10,2) DEFAULT 0,   -- redemption fees charged by the casino
  method redemption_method NOT NULL DEFAULT 'ach',
  is_crypto BOOLEAN DEFAULT FALSE,
  bank_note VARCHAR(255),
  status redemption_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  cancelled_at TIMESTAMP
);

CREATE INDEX idx_redemptions_user_status ON redemptions(user_id, status, submitted_at DESC);
CREATE INDEX idx_redemptions_casino_completed ON redemptions(casino_id, status, confirmed_at DESC);
```

The `fees_usd` column matters for two things: accurate P/L (net = usd_amount - fees_usd), and the aggregated redemption time stats feature (see below). The public stats show net amounts only.

### `ledger_entries`
The source of truth for P/L. Entries are created automatically by the system (claims, confirmed redemptions) or manually (adjustments, offer purchases).

```sql
CREATE TYPE ledger_entry_type AS ENUM (
  'daily',           -- from daily_bonus_claims
  'offer',           -- a purchase/promotion (manual entry: SC in, USD out)
  'winnings',        -- gambling session result (positive)
  'wager',           -- gambling session cost (negative SC)
  'adjustment',      -- manual correction
  'redeem_confirmed' -- from redemption reaching 'received' status
);

CREATE TABLE ledger_entries (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  entry_type ledger_entry_type NOT NULL,
  sc_amount DECIMAL(10,2),    -- positive = SC earned, negative = SC spent
  usd_amount DECIMAL(10,2),   -- positive = USD received, negative = USD spent
  is_crypto BOOLEAN DEFAULT FALSE,
  notes TEXT,
  source_redemption_id INT REFERENCES redemptions(id),
  source_claim_id INT REFERENCES daily_bonus_claims(id),
  link_id VARCHAR(255),    -- future use: links to play_sessions or offers by ID
  entry_at TIMESTAMP DEFAULT NOW(),
  entry_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_ledger_user_casino_date ON ledger_entries(user_id, casino_id, entry_date DESC);
CREATE INDEX idx_ledger_user_type ON ledger_entries(user_id, entry_type);
CREATE INDEX idx_ledger_link_id ON ledger_entries(link_id);
```

### `user_settings`
Per-user preferences. Separate table so `auth_sessions` stays lean.

```sql
CREATE TABLE user_settings (
  user_id VARCHAR(255) PRIMARY KEY,
  timezone VARCHAR(50) DEFAULT 'America/New_York',  -- IANA timezone
  home_state CHAR(2),                               -- for pullout alert routing
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `ban_reports`, `ban_uptick_alerts`, `auth_sessions`, `clicks`
Keep these from the existing schema, no changes needed.

---

## The redemption state machine — implement this exactly

This is the most complex flow in the system. Get it right.

**When a user submits a new redemption:**
1. Create a `redemptions` row with `status = 'pending'`
2. Do NOT create a ledger entry yet
3. Show the pending redemption in the UI as "in transit" — the SC has left the casino balance but cash hasn't arrived

**How casino balance is calculated for a user:**
```
available_sc = (sum of ledger_entries.sc_amount for this user+casino)
             - (sum of redemptions.sc_amount WHERE status = 'pending')
```
The pending amount is subtracted from displayed balance because it's committed. The ledger doesn't reflect it yet because cash hasn't arrived.

**When a user marks a redemption as received:**
1. Set `redemptions.status = 'received'`, set `confirmed_at = NOW()`
2. Create a `ledger_entries` row: `entry_type = 'redeem_confirmed'`, `usd_amount = +[amount received]`, `sc_amount = -[sc_amount]`, link `source_redemption_id`
3. Now the money is in the ledger

**When a redemption is cancelled or rejected:**
1. Set status to `'cancelled'` or `'rejected'`
2. Do NOT create a ledger entry
3. SC balance restores automatically because pending deduction disappears

---

## The affiliate two-state logic — implement this exactly

The gate is ledger-based. If an authenticated user has ANY `ledger_entries` rows for a given casino, they've joined that casino — show a direct link. If they have no ledger entries for a casino (or are anonymous), fire the affiliate link.

**Why ledger-based and not a flag:** An explicit "is_joined" flag requires the user to manually tell us they joined. The ledger tells us automatically — the moment they log a claim or any other entry for a casino, they've been playing there. This is more reliable and removes friction. It also prevents a class of abuse where someone manually sets a flag to avoid seeing affiliate links for casinos they haven't joined.

**Implementation:**
```
user_has_joined(user_id, casino_id) = EXISTS (
  SELECT 1 FROM ledger_entries
  WHERE user_id = $1 AND casino_id = $2
  LIMIT 1
)
```

For anonymous users: always show affiliate link. For authenticated users: check ledger.

**When an affiliate click happens:** Log a row to `clicks` (casino_id, user_id if authed, referrer_source, clicked_at), then redirect to the affiliate URL via `casinos.affiliate_link_url`. The redirect must go through `/api/affiliate/click` — never embed the raw affiliate URL directly in the page HTML where it can be scraped.

The daily tracker surfaces not-joined casinos as a distinct section below the main checklist — "Casinos you haven't claimed at yet." Every click from that section logs to `clicks` with `referrer_source = 'tracker_suggestions'`.

---

## Feature specs

### 1. Deploy configuration (do first)

Wire `@astrojs/vercel` into `astro.config.ts`. Create `src/lib/db.ts` with the Neon connection (reads `DATABASE_URL` from env). Create `.env.example`. All Neon queries go through `src/lib/db.ts` — no inline connection strings anywhere.

---

### 2. Casino directory (public)

- `/casinos` — grid/list view, filterable by tier, sortable by rating. Casino cards show: name, tier badge, rating, ban risk, redemption speed, state availability status for the user's state (if known).
- `/casinos/[slug]` — full casino profile. Renders the MDX editorial content + structured data panel: tier, rating, wash games, RTP games table, ban risk, redemption speed/fee, crossing info, parent company, streak mode, reset time.
- Affiliate CTA button on each profile page — two-state logic as described above.
- Ban reports feed on the casino profile page — show published reports, sorted by date. Show uptick alert banner if `ban_uptick_alerts` has an active alert for this casino.
- State availability notice per casino — if `casino_state_availability` has a non-`available` status, show it prominently. For `legal_but_pulled_out`: amber warning. For `operates_despite_restrictions`: factual grey note, no alarming language, no endorsement.

**MDX frontmatter expansion:** Add `claimUrl`, `streakMode`, `resetTimeLocal`, `resetTimezone`, `hasStreaks`, `scToUsdRatio`, `parentCompany`, `cwMode` to the existing schema in `src/content/config.ts`. The Zod schema is already there — extend it.

---

### 3. State availability (public)

- `/states` — US map or table. Each state shows: legal status, how many casinos are available, recent pullout alerts.
- `/states/[code]` — state detail: legal status with source, list of all casinos available in that state, any recent pullout events.
- Community report submission form for state status changes — same IP deduplication flow as ban reports (3 same-IP reports in 7 days → flagged). Community reports do NOT automatically update `casino_state_availability`. They go into `state_availability_reports` as `is_published = false` for admin review.
- State pullout alert fires from TWO paths:
  - **Admin update:** When platform admin directly sets `casino_state_availability.status = 'legal_but_pulled_out'` for a casino+state
  - **Accepted community report:** When an admin approves a `state_availability_reports` row (sets `is_published = true`) and the reported status is `legal_but_pulled_out`
  - Either path triggers: create `state_pullout_alerts` row, send email to all users in `user_state_subscriptions` for that state
- This is the most valuable free feature on the platform. The admin review gate prevents false alerts from being broadcast.

---

### 4. Ban report system (public)

Spec is mostly correct from v1. The additions:
- IP dedup threshold: 3 same-IP reports for any casino in 7 days → `is_flagged = true`
- Uptick threshold: 5 unique-IP reports for same casino in 7 days → write `ban_uptick_alerts` row
- Published reports appear on the casino detail page
- Uptick alert shows as a banner on the casino detail page: "⚠️ Elevated ban activity reported in the last 7 days"

---

### 5. Daily tracker (private, auth required)

Route: `/tracker`

The tracker is a React component (Astro island, `client:load`). It shows the user's list of tracked casinos for today.

**Per casino row in the tracker:**
- Casino name (clicking it opens claim URL in new tab)
- Countdown to next reset — calculated server-side, passed as a prop. Rolling 24h: countdown from last claim time. Fixed time: countdown to next `reset_time_local` converted to user's timezone.
- "Claimed" status for today — pulled from `daily_bonus_claims` for today's date
- Quick entry buttons: **Daily** (mark daily SC claimed), **Spins** (log free spins), **Adjust** (manual SC adjustment)
- SC amount input + save — for logging the actual SC amount received
- When saved: POST to `/api/tracker/claim` → creates `daily_bonus_claims` row + creates `ledger_entries` row of type `'daily'`

**Reset countdown logic:**

Use **Luxon** for all timezone and DST handling. Do not use `date-fns-tz`, do not roll your own DST logic. The reference implementation is in the existing app's `lib/v2/casinoReset.ts` — replicate the `computeCasinoResetSummary` function in `src/lib/reset.ts`. The key logic:

- `streak_mode = 'fixed'`: parse `reset_time_local` as `HH:MM`, use `casino.reset_timezone` as the IANA zone. Compute today's reset moment in that zone. If current time is past it, the window started today; next reset is tomorrow at the same time. If current time is before it, the window started yesterday; next reset is today. Luxon handles DST transitions automatically when you `.set()` hour/minute within a timezone.
- `streak_mode = 'rolling'`: next available = `last_claim.claimed_at + 24 hours`. If no prior claim, show "Available now."
- No `streak_mode` or unknown: show "Reset time unknown — check the casino site." Link to submit a reset time suggestion.

User timezone for display comes from `user_settings.timezone`, set during onboarding. Never infer from IP.

**"Not joined" section below the tracker:**
A secondary list of casinos from the platform that the user hasn't joined. Each shows typical SC value (from `casinos` — the platform-level estimate, not user-specific since they haven't joined). Clicking fires the affiliate link.

**User's tracked casino list:** Pulled from `user_casino_settings` WHERE `user_id = X`. User can add/remove casinos from their tracker. Adding a casino prompts them to enter their `typical_daily_sc` for it.

---

### 6. Redemption tracker (private, auth required)

Route: `/redemptions`

- List of all redemptions, filterable by status (pending / received / cancelled / rejected), sortable by date
- "Submit Redemption" button → modal form: casino (dropdown from user's `user_casino_settings`), SC amount, USD amount, method (ACH / crypto / gift card), bank note (optional), notes
- Each pending redemption shows: casino, amount, method, submitted date, an elapsed time indicator ("submitted 3h ago")
- Actions per pending redemption: **Mark Received** (triggers the ledger entry creation), **Cancel**, **Reject**
- "In Transit" balance shown at top of page: total USD pending across all active redemptions

---

### 7. Ledger (private, auth required)

Route: `/ledger`

- All `ledger_entries` for the user, paginated (20/page), filterable by casino and entry type, filterable by date range
- Summary header: total SC in/out, total USD in/out, net P/L (USD in minus USD out). No other calculations — no tax math of any kind.
- Manual entry form: add an entry of any type (useful for logging offer purchases, winnings, adjustments manually)
- CSV export of filtered results
- Per-casino summary table: for each casino the user has entries for, show SC balance, USD balance, net

**P/L calculation — this is the whole formula:**
```
net_pl_usd = SUM(usd_amount) WHERE entry_type IN ('redeem_confirmed', 'offer', 'winnings', 'adjustment', 'wager')
```
`usd_amount` is positive for money in, negative for money out. Net is the sum. That is all.

When creating the `redeem_confirmed` ledger entry, the `usd_amount` should be **net of fees**: `usd_amount = redemption.usd_amount - redemption.fees_usd`. Gross and fees are stored on the `redemptions` row for reference; the ledger reflects what actually landed.

---

### 8. Auth (email OTP)

Routes: `POST /api/auth/request-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/logout`

6-digit OTP, 15-minute expiry. Store hashed in `auth_sessions.otp_token_hash`. On verify: set `session_token` cookie (HttpOnly, Secure, SameSite=Strict), 30-day expiry. Session middleware checks cookie on all `/api/*` routes that require auth.

For email delivery: **Resend** is the recommendation — simple API, good free tier, works natively on Vercel. Open to debate. Whatever you pick, the provider is abstracted behind `src/lib/email.ts` so it can be swapped.

When a user first verifies their email, prompt them to set their home state — this populates `user_state_subscriptions` and enables the pullout alert system immediately.

---

### 9. Homepage

`/` — the marketing surface for new players.

- Headline + subheadline: what SweepsIntel is (intelligence layer for sweepstakes players)
- CTA to the tracker (convert existing players) and to the casino directory (convert new players)
- Active state pullout alerts — if any `state_pullout_alerts` have fired in the last 30 days, show them prominently. This is proof of value on the homepage.
- Active ban uptick alerts — same, show recent ban activity
- Top-rated casinos grid (tier 1, sorted by rating)
- Discord embed: `https://discord.gg/9CgSgJHFu8`

---

## File structure

```
src/
  components/
    casino/           -- CasinoCard, CasinoDetailPanel, RTPGamesTable, BanReportFeed
    tracker/          -- DailyTracker (React), CasinoRow, ResetCountdown, ClaimModal
    redemptions/      -- RedemptionList, RedemptionForm, InTransitBanner
    ledger/           -- LedgerTable, LedgerSummary, ManualEntryForm
    states/           -- StateMap, StateCard, PulloutAlertBanner
    auth/             -- OTPForm, SessionGate
    layout/           -- Header, Footer, Nav
  lib/
    db.ts             -- Neon connection + query helpers
    auth.ts           -- OTP generation, session validation, middleware
    affiliate.ts      -- Affiliate link resolution (Neon lookup, MDX fallback)
    email.ts          -- Resend abstraction
    reset.ts          -- Casino reset time calculation (rolling_24h + fixed_time + DST)
    balance.ts        -- Casino SC balance calculation (ledger + pending redemptions)
  pages/
    index.astro
    casinos/
      index.astro
      [slug].astro
    states/
      index.astro
      [code].astro
    tracker.astro
    redemptions.astro
    ledger.astro
    api/
      auth/
        request-otp.ts
        verify-otp.ts
        logout.ts
      tracker/
        claim.ts
        status.ts
      redemptions/
        submit.ts
        update-status.ts   -- handles received / cancelled / rejected
      ledger/
        entry.ts
      reports/
        ban-submit.ts
        state-submit.ts
        reset-suggestion.ts
      affiliate/
        click.ts           -- logs click, redirects to affiliate URL
  content/
    casinos/           -- MDX files (10 already drafted, schema to be extended)
    config.ts          -- Zod schema (extend with new fields)
```

---

## Average redemption times — platform-level aggregation

This is a major differentiator and needs to be built into the casino profile from day one. No other platform has this because no other platform has users logging their actual redemptions.

**What it is:** Aggregate `confirmed_at - submitted_at` across ALL users' completed redemptions for each casino to produce public-facing redemption time statistics.

**Where it shows:** On each casino's `/casinos/[slug]` profile page, in the structured data panel:
- "Median redemption time: 2.3 days"
- "80th percentile: 4.1 days"
- "Based on 84 community redemptions"
- If fewer than 5 completed redemptions: show "Insufficient data"

**Trend signal:** Compare the median processing time of the most recent 30 days of completed redemptions vs. the 30 days before that. If the recent median is more than 20% slower: show "⚠️ Processing times appear to be increasing recently." This is the early warning sign that operators care about.

**Implementation:** A `src/lib/redemption-stats.ts` module that queries:
```sql
SELECT
  EXTRACT(EPOCH FROM (confirmed_at - submitted_at)) / 86400.0 AS days
FROM redemptions
WHERE casino_id = $1
  AND status = 'received'
  AND confirmed_at IS NOT NULL
ORDER BY confirmed_at DESC
LIMIT 1200
```
Then compute median and p80 in application code (same approach as the reference app's `lib/v2/redemptions.ts`). Cache the result per casino — this doesn't need to be real-time, a 1-hour cache is fine.

**Privacy:** The aggregated stats expose no individual user data — only aggregate median/p80 and sample size.

**Premium hook:** "Stuck" detection — when a specific user's pending redemption exceeds the p80 for that casino, flag it in their redemption tracker. ("This redemption is taking longer than usual for this casino.") This uses the same stats but applied personally. Free users see the public casino stats; premium users get personal stuck alerts.

---

## Hard constraints

- All Neon queries through `src/lib/db.ts`. No inline connection strings.
- `reporter_ip_hash` is always a SHA-256 hash of the IP. Hash server-side. Never store raw IPs.
- SC balance for a user+casino is always calculated dynamically (ledger + pending redemptions). Never stored as a static column — it would go stale.
- Affiliate link resolution always comes from `casinos.affiliate_link_url` in Neon. MDX `affiliateLink` field is for editorial reference only — never used for live clicks.
- The limbo state machine is non-negotiable. Redemption confirmed → ledger entry. Not before.
- No tax calculations, tax fields, or tax language anywhere in the codebase or UI. P/L is money in minus money out. That is the complete definition.
- Multi-user from day one. Every personal data query is scoped to `user_id`. No "admin" shortcuts that query across users.

---

## What the data model leaves room for (don't build, don't block)

- **Offer management system:** `offers` table with `cost_usd`, `face_value_sc`, `rtp_pct`, `status` (new/approved/completed/cancelled), `headline`, `promo_code`, `expires_at`. The margin math is: `expected_return_sc = face_value_sc * rtp_pct`, `expected_profit_usd = expected_return_sc - cost_usd`, `expected_margin_pct = expected_profit_usd / cost_usd`. No other variables. When an offer is completed, it auto-creates a ledger `offer` entry. The `offer` ledger type already exists.
- **Wash/betting sessions:** `play_sessions` table (casino_id, game_name, start_sc, end_sc, start_washed, end_washed, sc_per_spin, washed_mode ['winnings'|'wagers']). Session math: `delta_sc = end_sc - start_sc`, `coin_in = delta_washed - delta_sc` (if washed_mode=winnings), `spins = coin_in / sc_per_spin`, `realized_rtp = returns / wagers`. Session close auto-creates `wager` + `winnings` ledger entries. Reference the logic in the existing app's `lib/v2/ledger.ts` → `deriveSessionMetrics`.
- **Stuck redemption alerts (premium):** Using the aggregated p80 per casino from `redemption-stats.ts`, flag a user's pending redemption if `NOW() - submitted_at > p80_days * 1.1`. Surface this in their `/redemptions` page.
- **Premium tier feature gate:** Add `plan VARCHAR(20) DEFAULT 'free'` to `user_settings`. Gate offer management and session tracking behind `plan = 'premium'`.
- **State alert email digest:** Currently individual emails on pullout event. Future: configurable digest (immediate / daily / weekly) per user.

---

## Open questions for Codex

These are genuine decision points, not rhetorical. Push back where you have better answers:

1. **Casino balance as a view vs. computed in application code:** `available_sc = ledger_entries sum - pending redemptions sum` could be a Postgres VIEW per user+casino, or computed in `src/lib/balance.ts` at query time. What's your preference? The view is more portable for future reporting; the application code is easier to debug. Either way, it must never be a stored column.

2. **State pullout email timing:** The spec says send immediately when admin approves the alert. Is there a batching strategy that makes more sense (e.g., if 3 casinos all pull out of a state on the same day, don't send 3 separate emails)? Or is one-event-one-email always right for something this high-value?

3. **Astro island hydration for tracker:** `client:load` vs. `client:idle`. The tracker is the primary UI on `/tracker` so `client:load` seems right. Counter if not.

4. **OTP email provider:** Resend is the recommendation. Push back if you'd go elsewhere.

5. **Redemption time stats caching:** Proposed approach is 1-hour application-level cache per casino. Alternative: a nightly materialized view refresh. Given the data volume at launch will be low, the application-level cache seems right. What's your call once traffic scales?

6. **Affiliate link redirect:** The spec says all affiliate clicks must go through `/api/affiliate/click` rather than being embedded in HTML. This means every casino card renders a button that POSTs to the API, which logs the click then returns a redirect. Is there a meaningful SEO or UX reason to expose the affiliate URL directly vs. keeping it behind the API route? We lean toward the API route for both analytics and to avoid URL scraping.

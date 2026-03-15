# SweepsIntel — v4 Codex Prompt

_Working draft. Dylan + PM iterate before sending._

---

## What we're building and why it matters

SweepsIntel is a sweepstakes casino intelligence platform for the US market. It serves two groups: new players researching which casinos to join, and experienced operators running multiple accounts who want tools to track their activity and access community-sourced intel.

New players are the affiliate conversion pipeline. When someone lands on a casino profile, trusts it, and clicks through to join — that's a CPA event worth $20–40. The daily tracker is the retention engine that brings them back and exposes them to more casinos they haven't joined yet.

Experienced operators are harder to convert initially but become the platform's credibility. Their community reports — ban incidents, state pullouts, reset time corrections, volatility reports — are what make the intel accurate over time.

The revenue model for launch is affiliate CPA only. Everything in the MVP is free. Premium tier hooks are in the schema from day one but not activated.

---

## Platform context — important

**SweepsIntel is an AI-managed, Collective-operated business.** Dylan is the owner and editorial authority, but he cannot operate this alone — that's the point. The platform needs to be operable by an AI agent with minimal human touch per action. Dylan functions as a fast approver, not a full-time editor.

This shapes the admin UI requirements significantly. The admin panel is not a bonus — it is in scope and essential. Without it, Dylan cannot efficiently review a 5-second approval queue, moderate community reports, or respond to intel flagged from the Discord monitoring pipeline. The admin UI is the interface between the AI-managed operations layer and Dylan.

**Companion documents:**
- `MONITORING-SPEC-v1.md` in this directory defines the Discord monitoring pipeline architecture — how intel is extracted, filtered, and routed to the ingest endpoint. Read it for context on the `confidence` and `confidence_reason` fields on `discord_intel_items`, and why the admin queue displays them.
- `UI-SPEC-v1.md` in this directory defines visual layouts, component states, empty states, interaction patterns, and responsive behavior for every page. Read it when building any user-facing component — it specifies exactly how things should look at each state.

---

## Reference material — important

There is an existing personal sweepstakes tracking app (Dylan's). It handles daily tracking, redemptions, offer management, session logging, and a full ledger. **Do not scaffold off it.** It exists as a reference and case study. Treat it like a wireframe: understand the intent and data flows, then implement cleanly from scratch.

The reason: prior attempts to scaffold off it resulted in inheriting architectural decisions that aren't right for a multi-user public platform. Start fresh.

Key reference files (read these, don't reuse the architecture):
- `Casino/web/lib/v2/casinoReset.ts` — Luxon reset time logic (replicate in `src/lib/reset.ts`)
- `Casino/web/lib/v2/redemptions.ts` — median/p80 functions, `buildRedemptionCasinoViews`
- `Casino/web/lib/offer-math.ts` — offer margin math
- `Casino/web/prisma/schema.prisma` — domain model reference (field names, enums)
- `Casino/web/lib/v2/ledger.ts` — `deriveSessionMetrics` for future session tracking

---

## Tech stack

- **Astro 4** with hybrid output mode — mostly static pages with server-rendered API routes and a few interactive islands
- **React 18** for interactive components (daily tracker, redemption tracker, ledger UI, admin panel)
- **Neon PostgreSQL** for all persistence
- **Vercel** for deployment — auto-deploy on push to main
- **TypeScript** throughout
- **Luxon** for all timezone and DST calculations. No alternatives.
- **Resend** for transactional email (OTP, state pullout alerts)

There is already an initialized scaffold at the project root. Wire `@astrojs/vercel` into `astro.config.ts` first — that unblocks deployment from day one.

There are 11 casino MDX files already drafted in `src/content/casinos/` (including `myprize.mdx` — the Getting Started casino) and a typed Astro content collection defined in `src/content/config.ts`. Extend the frontmatter schema as described below.

---

## Architecture — four layers

**Public layer** (no auth, search-indexed, the marketing surface):
Casino profiles, state availability map, ban reports feed, reset time community database, state pullout alerts, volatility community reports. This is what new players find first and what earns SEO authority.

**Private MVP layer** (email OTP auth required, personal tools):
Daily tracker, redemption tracking, ledger, in-app notifications. Tightly coupled and must be built as one system. A claim creates a ledger entry automatically. A redemption creates a pending entry that only moves to the ledger on confirmed receipt.

**Admin layer** (admin auth required, Collective operations):
Casino CRUD, ban report moderation queue, community suggestion approval/rejection, admin flags from intel sources, state pullout alert management, email blast controls, AI-proposed action review. This layer is what makes AI-managed operations possible.

**Future premium layer** (data model must leave room for this, don't build it now):
Offer calculator, wash session tracking, advanced P/L reporting, stuck redemption personal alerts, advanced cross-wash calculator.

---

## Full data model

Run this schema against Neon. This document is authoritative. (The old `NEON_SCHEMA.sql` has been archived.)

### `casinos`

```sql
CREATE TABLE casinos (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  tier INT DEFAULT 2,                           -- 1=top tier, 2=solid, 3=marginal
  rating DECIMAL(3,1),
  claim_url TEXT,                               -- direct URL to daily bonus claim page
  streak_mode VARCHAR(20) DEFAULT 'rolling',    -- 'rolling' | 'fixed'
  reset_time_local VARCHAR(5),                  -- HH:MM string for fixed mode
  reset_timezone VARCHAR(50),                   -- IANA timezone e.g. 'America/New_York'
  has_streaks BOOLEAN DEFAULT FALSE,
  sc_to_usd_ratio DECIMAL(6,4) DEFAULT 1.0,    -- SC per $1 USD
  parent_company VARCHAR(100),                  -- e.g. 'VGW', 'PriorityPlay'
  -- Promoban risk (structured fields — not a freeform string)
  promoban_risk VARCHAR(20) DEFAULT 'unknown',  -- 'none' | 'low' | 'medium' | 'high' | 'unknown'
  hardban_risk VARCHAR(20) DEFAULT 'unknown',   -- 'none' | 'low' | 'medium' | 'high' | 'unknown'
  family_ban_propagation BOOLEAN DEFAULT FALSE, -- ban at one family member = ban at all
  ban_confiscates_funds BOOLEAN DEFAULT FALSE,  -- does a ban void your SC/USD balance?
  promoban_triggers TEXT,                       -- directional notes only, kept vague intentionally
  ban_notes TEXT,                               -- additional ban context
  -- Playthrough
  playthrough_multiplier DECIMAL(4,2),          -- e.g. 1.0 for full-value, 0.5 for slots-only
  playthrough_notes TEXT,                       -- game-specific rules, exceptions
  -- Daily bonus display (platform-level descriptor for unjoined casino cards)
  daily_bonus_desc VARCHAR(100),                -- e.g. "~100-500 SC/day depending on tier" — admin-edited, not user-specific
  daily_bonus_sc_avg INT,                       -- admin-set seed value for sorting the "not joined" section in tracker. Overridden by real aggregated user claim data once available — see tracker Section 2 sort logic.
  -- Cross-wash / live games
  has_live_games BOOLEAN DEFAULT FALSE,
  cw_direction VARCHAR(20),                     -- 'to_only' | 'from_only' | 'either' | null (intra-family SC transfer direction)
  cw_notes TEXT,                                -- live game cross-wash notes, bet sizing context (premium content, paywalled)
  -- Redemption
  redemption_speed_desc VARCHAR(100),           -- human-readable e.g. "24-48hr ACH"
  redemption_fee_desc VARCHAR(100),             -- e.g. "Free ACH, $5 crypto"
  min_redemption_usd DECIMAL(10,2),
  -- Affiliate
  has_affiliate_link BOOLEAN DEFAULT FALSE,
  affiliate_link_url TEXT,
  affiliate_type VARCHAR(20),                   -- 'cpa' | 'rev_share' | 'hybrid'
  affiliate_enrollment_verified BOOLEAN DEFAULT FALSE,
  -- Platform curation
  source VARCHAR(20) DEFAULT 'admin',           -- 'admin' (curated, has profile) | 'user_suggested' (created when user adds an unrecognized casino to their tracker — no profile yet)
  is_excluded BOOLEAN DEFAULT FALSE,            -- if true: never surfaces in Section 2, directory, or affiliate CTAs. Users can still personally track it. Dylan's editorial veto.
  -- Meta
  notes TEXT,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `game_providers`
Tracks live game and slot providers — needed for cross-wash compatibility and state restriction tracking.

```sql
CREATE TABLE game_providers (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,   -- e.g. 'evolution', 'pragmatic', 'playtech'
  name VARCHAR(100) NOT NULL,
  is_live_game_provider BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `casino_live_game_providers`
Junction table: which casinos use which live game providers.

```sql
CREATE TABLE casino_live_game_providers (
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  provider_id INT REFERENCES game_providers(id) ON DELETE CASCADE,
  PRIMARY KEY (casino_id, provider_id)
);
```

### `casino_game_availability`
Tracks specific games available at specific casinos — one level below `casino_live_game_providers` (which tracks providers). Critical for cross-wash strategy: knowing "Chanced has Iconic 21 BJ" or "Crown has Evolution Roulette" is operational intel. Populated by the Discord monitoring pipeline and admin edits. Confidence builds over time as signals accumulate.

```sql
CREATE TABLE casino_game_availability (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  provider_id INT REFERENCES game_providers(id),    -- nullable: monitoring may identify game before provider
  game_name VARCHAR(100) NOT NULL,                   -- "Iconic 21 BJ", "Evolution Lightning Roulette", etc.
  game_type VARCHAR(50),                             -- 'blackjack' | 'roulette' | 'baccarat' | 'slots' | 'dice' | 'other'
  is_cross_wash_relevant BOOLEAN DEFAULT FALSE,      -- flagged as relevant for cross-wash pairing
  confidence VARCHAR(20) DEFAULT 'unverified',       -- 'high' | 'medium' | 'low' | 'unverified' — builds with signal volume
  positive_signal_count INT DEFAULT 0,               -- monitoring pipeline increments on each confirming mention
  negative_signal_count INT DEFAULT 0,               -- monitoring pipeline increments on each "this game is gone" mention
  last_confirmed_at TIMESTAMP,                       -- most recent positive signal timestamp
  last_negative_at TIMESTAMP,                        -- most recent negative signal timestamp
  status VARCHAR(20) DEFAULT 'available',            -- 'available' | 'removed' | 'unconfirmed'
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(casino_id, game_name)                       -- one row per game per casino; signals update existing row
);

CREATE INDEX idx_game_avail_casino ON casino_game_availability(casino_id, status, is_cross_wash_relevant);
CREATE INDEX idx_game_avail_negative ON casino_game_availability(negative_signal_count) WHERE negative_signal_count >= 2;
```

**Confidence scoring logic:**
- `positive_signal_count >= 3` AND `negative_signal_count = 0` → `confidence = 'high'`
- `positive_signal_count >= 1` AND `negative_signal_count = 0` → `confidence = 'medium'`
- `positive_signal_count >= 1` AND `negative_signal_count >= 1` → `confidence = 'low'` (conflicting signals)
- `positive_signal_count = 0` → `confidence = 'unverified'`
- Update confidence on every signal increment.

**Negative signal escalation:** When `negative_signal_count >= 2`, create an `admin_flags` row with `flag_type = 'game_availability_change'`, `ai_summary = "[Game] may no longer be available at [Casino] — [N] negative reports"`, `proposed_action = "Verify and update status to 'removed' or dismiss"`. This catches provider-level shifts that matter for cross-wash pairing.

**Status transitions:** Admin manually sets `status = 'removed'` after verifying. A removed game that gets new positive signals auto-flips back to `status = 'unconfirmed'` and resets `negative_signal_count = 0` (it may have returned).

**Display:** On the casino profile page, show cross-wash-relevant games in the Live Games section: game name, provider, confidence badge (same color scheme as discord intel: high=green, medium=yellow, low=orange, unverified=gray). This is public — knowing which games exist at which casino is free information. Cross-wash *strategy* notes (`cw_notes`) remain paywalled.

### `provider_state_availability`
Game provider state-level restrictions. A provider exiting a state affects cross-wash availability at ALL casinos using that provider in that state simultaneously.

```sql
CREATE TABLE provider_state_availability (
  id SERIAL PRIMARY KEY,
  provider_id INT REFERENCES game_providers(id) ON DELETE CASCADE,
  state_code CHAR(2) REFERENCES state_legal_status(state_code),
  status state_avail_status NOT NULL DEFAULT 'available',
  notes TEXT,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_id, state_code)
);
```

### `game_volatility_reports`
Community-reported game volatility. Replaces the old `casino_rtp_games` table. RTP data from publishers cannot be trusted (casinos change values without notice). Community volatility consensus is more durable.

```sql
CREATE TABLE game_volatility_reports (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  game_name VARCHAR(100) NOT NULL,
  provider_id INT REFERENCES game_providers(id),
  reported_volatility VARCHAR(20) NOT NULL,  -- 'low' | 'medium' | 'high'
  reported_rtp_pct DECIMAL(5,2),             -- community-observed, optional, explicitly not authoritative
  user_id VARCHAR(255) NOT NULL,
  trust_score_at_report DECIMAL(3,2) DEFAULT 1.0,  -- snapshot of user trust score
  notes TEXT,
  is_flagged BOOLEAN DEFAULT FALSE,                -- IP dedup threshold triggered
  is_published BOOLEAN DEFAULT FALSE,              -- admin must approve before report counts toward consensus
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_volatility_casino_game ON game_volatility_reports(casino_id, game_name, created_at DESC);
```

**Aggregation logic:** For display on casino profiles, compute the consensus volatility per game by taking all **published** reports (`is_published = true`) weighted by `trust_score_at_report`. Show: mode volatility + count of reports + "community-reported" label. If reports conflict significantly (no clear mode), show "Disputed." Never show raw `reported_rtp_pct` as authoritative — label it "community-observed RTP (may not reflect current casino settings)."

**Why this replaces publisher RTP:** Published RTP values are not reliable. Casinos can change game RTP settings unilaterally and silently. Community volatility consensus degrades gracefully — it reflects player experience, not vendor claims. The downside is quality noise: a user who has a bad session may over-report "high" volatility. Trust scoring mitigates this.

### `user_casino_settings`
User-specific settings per casino. Personal data only.

```sql
CREATE TABLE user_casino_settings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  typical_daily_sc DECIMAL(8,2),     -- user's own expected daily SC at this casino
  personal_notes TEXT,
  sort_order INT,                    -- user-defined sort position in tracker top section (drag-reorder)
  added_at TIMESTAMP DEFAULT NOW(),
  removed_at TIMESTAMP,              -- soft-delete: when set, casino is hidden from Section 1 but row is preserved. Re-adding the casino nulls this field and restores sort_order. SCOPE: soft-delete ONLY affects this row. Associated data (daily_bonus_claims, ledger_entries, redemptions, discord_intel_reactions) is NEVER deleted or filtered by removed_at. Those rows persist for analytics, P/L, and redemption stats. The only query that checks removed_at is the Section 1/Section 2 split on the tracker page.
  UNIQUE(user_id, casino_id)
);
```

**Soft-delete behavior:** When a user removes a casino from their tracker, set `removed_at = NOW()` — do NOT hard-delete the row. All tracker queries (Section 1, "My Alerts" filtering, tracked-by counts) filter on `removed_at IS NULL`. When the user re-adds the same casino, null out `removed_at` and preserve their existing `sort_order` and `personal_notes`. This preserves the "tracked-by count" signal on user-suggested casinos (admin sees total unique users who ever tracked it, not just current), and lets users return to a casino without losing their settings.

No `is_joined` flag. Joined status is inferred from the ledger (see affiliate gate section).

### `state_legal_status`

```sql
CREATE TABLE state_legal_status (
  state_code CHAR(2) PRIMARY KEY,
  state_name VARCHAR(50) NOT NULL,
  sweepstakes_legal BOOLEAN NOT NULL,
  legal_notes TEXT,
  last_verified DATE,
  source_url TEXT
);
```

### `casino_state_availability`

```sql
CREATE TYPE state_avail_status AS ENUM (
  'available',
  'restricted',
  'legal_but_pulled_out',
  'operates_despite_restrictions'
);

CREATE TABLE casino_state_availability (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  state_code CHAR(2) REFERENCES state_legal_status(state_code),
  status state_avail_status NOT NULL DEFAULT 'available',
  compliance_note TEXT,
  community_reported BOOLEAN DEFAULT FALSE,
  reported_at TIMESTAMP,
  verified BOOLEAN DEFAULT FALSE,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(casino_id, state_code)
);
```

### `state_availability_reports`

```sql
CREATE TABLE state_availability_reports (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  provider_id INT REFERENCES game_providers(id),  -- optional: for reporting provider-level state exits (e.g. "Pragmatic Play no longer works in my state")
  state_code CHAR(2),
  reported_status state_avail_status NOT NULL,
  report_text TEXT NOT NULL,
  reporter_ip_hash VARCHAR(64),
  reporter_user_id VARCHAR(255),
  is_flagged BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  submitted_at TIMESTAMP DEFAULT NOW()
);
```

### `state_pullout_alerts`

```sql
CREATE TABLE state_pullout_alerts (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),           -- null for provider-level cascade alerts
  provider_id INT REFERENCES game_providers(id),   -- set when alert is triggered by a provider state exit (cascade action); null for single-casino pullouts
  state_code CHAR(2),
  alert_message TEXT,
  was_broadcast BOOLEAN DEFAULT FALSE,
  broadcast_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `user_state_subscriptions`

```sql
CREATE TABLE user_state_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  state_code CHAR(2) REFERENCES state_legal_status(state_code),
  UNIQUE(user_id, state_code)
);
```

### `reset_time_suggestions`

```sql
CREATE TABLE reset_time_suggestions (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  suggested_streak_mode VARCHAR(20),
  suggested_reset_time VARCHAR(5),     -- HH:MM string (not TIME type)
  suggested_timezone VARCHAR(50),
  evidence_text TEXT,
  reporter_ip_hash VARCHAR(64),
  reporter_user_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'accepted' | 'rejected'
  admin_notes TEXT,
  submitted_at TIMESTAMP DEFAULT NOW()
);
```

### `daily_bonus_claims`

```sql
CREATE TABLE daily_bonus_claims (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  claim_type VARCHAR(20) NOT NULL DEFAULT 'daily',  -- 'daily' (standard daily login claim) | 'spins' (free spin promo claimed — distinct from daily because some casinos offer daily spins as a separate mechanic from the daily SC bonus) | 'adjustment' (admin or user correction of a missed/incorrect claim)
  sc_amount DECIMAL(8,2),
  notes TEXT,
  claimed_at TIMESTAMP DEFAULT NOW(),
  claimed_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, casino_id, claimed_date, claim_type)
);
```

### `redemptions`

```sql
CREATE TYPE redemption_status AS ENUM ('draft', 'pending', 'received', 'cancelled', 'rejected');
CREATE TYPE redemption_method AS ENUM ('ach', 'crypto', 'gift_card', 'other');

CREATE TABLE redemptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  sc_amount DECIMAL(10,2) NOT NULL,
  usd_amount DECIMAL(10,2) NOT NULL,  -- gross before fees
  fees_usd DECIMAL(10,2) DEFAULT 0,
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

### `ledger_entries`

```sql
CREATE TYPE ledger_entry_type AS ENUM (
  'daily',
  'offer',
  'winnings',
  'wager',
  'adjustment',
  'redeem_confirmed'
);

CREATE TABLE ledger_entries (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  entry_type ledger_entry_type NOT NULL,
  sc_amount DECIMAL(10,2),
  usd_amount DECIMAL(10,2),
  is_crypto BOOLEAN DEFAULT FALSE,
  notes TEXT,
  source_redemption_id INT REFERENCES redemptions(id),
  source_claim_id INT REFERENCES daily_bonus_claims(id),
  link_id VARCHAR(255),
  entry_at TIMESTAMP DEFAULT NOW(),
  entry_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_ledger_user_casino_date ON ledger_entries(user_id, casino_id, entry_date DESC);
CREATE INDEX idx_ledger_user_type ON ledger_entries(user_id, entry_type);
CREATE INDEX idx_ledger_link_id ON ledger_entries(link_id);
```

### `user_settings`

```sql
CREATE TABLE user_settings (
  user_id VARCHAR(255) PRIMARY KEY,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  home_state CHAR(2),
  ledger_mode VARCHAR(20) DEFAULT 'simple',  -- 'simple' | 'advanced'
  is_admin BOOLEAN DEFAULT FALSE,
  trust_score DECIMAL(3,2) DEFAULT 1.0,      -- used for community report weighting
  trust_score_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `user_notifications`
In-app notification panel. Created by system events (state pullouts, ban upticks, slow redemptions).

```sql
CREATE TYPE notification_type AS ENUM (
  'state_pullout',
  'ban_uptick',
  -- NOTE: 'redemption_slow' is intentionally NOT a notification type. Redemption slowdowns are passive banners, not notifications.
  'system'
);

CREATE TABLE user_notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  notification_type notification_type NOT NULL,
  casino_id INT REFERENCES casinos(id),
  state_code CHAR(2),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,           -- deep link to relevant page
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON user_notifications(user_id, is_read, created_at DESC);
```

### `admin_flags`
Flagged intel items that need admin review. Fed by automated sources (ban uptick detection, future Discord monitoring) and manual creation.

```sql
CREATE TABLE admin_flags (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,       -- 'ban_uptick' | 'state_report' | 'reset_suggestion' | 'manual' | 'discord_feed'
  flag_type VARCHAR(50) NOT NULL,    -- 'potential_pullout' | 'ban_surge' | 'redemption_slowdown' | 'data_anomaly' | 'new_casino_signal' | 'premium_content_candidate' | 'positive_redemption' | 'broken_platform_feature' | 'ban_report_discord' | 'game_availability_change'
                                     -- Not an enum — VARCHAR allows the monitoring pipeline to introduce new types without schema migration. Admin UI should handle unknown types gracefully (display raw flag_type as badge text).
  casino_id INT REFERENCES casinos(id),
  state_code CHAR(2),
  flag_content TEXT NOT NULL,        -- raw intel content
  ai_summary TEXT,                   -- AI-generated one-liner (populated by discord monitoring pipeline at ingest; null for non-discord flags)
  proposed_action TEXT,              -- AI-proposed admin action
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'actioned' | 'dismissed'
  created_at TIMESTAMP DEFAULT NOW(),
  actioned_at TIMESTAMP,
  actioned_by VARCHAR(255)
);

CREATE INDEX idx_admin_flags_status ON admin_flags(status, created_at DESC);
```

### `ban_reports`

```sql
CREATE TABLE ban_reports (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  report_type VARCHAR(50) NOT NULL,     -- 'promoban' | 'hardban' | 'account_review' | 'fund_confiscation'
  description TEXT NOT NULL,
  reporter_ip_hash VARCHAR(64),
  reporter_user_id VARCHAR(255),
  is_flagged BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ban_reports_casino ON ban_reports(casino_id, is_published, submitted_at DESC);
```

### `ban_uptick_alerts`

**Deactivation logic:** An alert auto-deactivates when the condition that triggered it is no longer true — i.e., when the count of unique-account ban reports for that casino within the last `window_days` drops below the uptick threshold (5). Check this on each new ban report submission or run a daily cleanup query: `UPDATE ban_uptick_alerts SET is_active = false WHERE is_active = true AND created_at < NOW() - INTERVAL '1 day' * window_days`. Admin can also manually dismiss via the admin flags queue (the `admin_flags` row created alongside the uptick alert). The banner on the casino profile page queries `WHERE casino_id = $1 AND is_active = true` — when no active rows exist, no banner shows.

```sql
CREATE TABLE ban_uptick_alerts (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  report_count INT NOT NULL,
  window_days INT DEFAULT 7,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `auth_sessions`

```sql
CREATE TABLE auth_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  session_token_hash VARCHAR(64) UNIQUE NOT NULL,
  otp_token_hash VARCHAR(64),
  otp_expires_at TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `clicks`
Tracks affiliate click events for internal analytics (which pages drive clicks, which casinos get interest). **CPA revenue tracking is external** — each casino's affiliate dashboard tracks conversions and payouts. SweepsIntel does not track CPA amounts, payout status, or conversion attribution internally. The `clicks` table is for platform analytics, not revenue accounting.

```sql
CREATE TABLE clicks (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  user_id VARCHAR(255),
  referrer_source VARCHAR(50),   -- 'tracker_suggestions' | 'casino_profile' | 'directory' | 'homepage'
  clicked_at TIMESTAMP DEFAULT NOW()
);
```

### `email_waitlist`
Newsletter-style soft capture from the public/info side of the site. These are NOT full user accounts. No OTP verification required — just an email address. Used for future email blasts to people who engaged before creating an account.

```sql
CREATE TABLE email_waitlist (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  source VARCHAR(50),            -- 'homepage_banner' | 'casino_profile' | 'state_page' | etc.
  captured_at TIMESTAMP DEFAULT NOW(),
  converted_user_id VARCHAR(255),  -- populated when this email completes OTP verification and becomes a full user
  converted_at TIMESTAMP           -- when the conversion happened
);
```

Do NOT create `user_settings` rows from waitlist captures. They are a separate funnel entirely.

### `discord_intel_items`
Sanitized intel items sourced from Discord monitoring (primarily Dogbear's #free-sc and #bearcave-chat channels). Content is always sanitized before storage — no usernames, no timestamps, no Discord attribution. Admin reviews and publishes; nothing auto-publishes.

```sql
CREATE TABLE discord_intel_items (
  id SERIAL PRIMARY KEY,
  item_type VARCHAR(50) NOT NULL,
    -- 'free_sc'           → free SC promo codes or bonuses
    -- 'promo_code'        → any promo code (may require purchase)
    -- 'flash_sale'        → timed offer with specific pricing
    -- 'playthrough_deal'  → playthrough change or favorable strategy intel
    -- 'platform_warning'  → bugs, cashout issues, redemption slowdowns
    -- 'state_intel'       → state availability changes, provider pullouts
    -- 'general_tip'       → useful but non-urgent casino tips
  casino_id INT REFERENCES casinos(id),           -- resolved from casino_slug at ingest; null if slug not matched
  casino_name_raw VARCHAR(100),                    -- raw casino name from monitoring script when casino_id could not be resolved; admin manually links or ignores
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,            -- sanitized — no Discord attribution, no usernames, no personal URLs
  content_hash VARCHAR(64),         -- SHA-256 of title+content for deduplication on ingest retries (ingest endpoint checks for existing row with same hash before inserting)
  source_channel VARCHAR(100),      -- 'free_sc' | 'bearcave_chat' (internal reference only, never shown to users)
  is_published BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,             -- same-day for promo codes and flash sales; null for tips/warnings
  confidence VARCHAR(20) DEFAULT 'unverified',  -- 'high' | 'medium' | 'low' | 'unverified' — set by monitoring pipeline at ingest
  confidence_reason TEXT,                        -- one-line explanation: "Tier 1 confirmed + 5 positive reactions" — displayed in admin queue
  auto_published BOOLEAN DEFAULT FALSE,  -- true when auto-publish escalation published this item without admin review
  confirm_count INT DEFAULT 0,      -- denormalized count from discord_intel_reactions
  dispute_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

CREATE INDEX idx_discord_intel_published ON discord_intel_items(is_published, expires_at, created_at DESC);
```

### `discord_intel_reactions`
Community verification for published intel items. One reaction per user per item.

```sql
CREATE TABLE discord_intel_reactions (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES discord_intel_items(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  reaction VARCHAR(10) NOT NULL,    -- 'confirm' | 'dispute'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(item_id, user_id)
);
```

**When a reaction is submitted:** Increment `discord_intel_items.confirm_count` or `dispute_count` to match. Display on each published item: "✓ 8 confirmed · ✗ 1 disputed." For promo codes specifically label it "✓ 8 users confirmed this works." For state intel: "✓ 6 users confirmed in their state." Adapt label by `item_type`. Auth required to react (prevents anonymous ballot stuffing). Rate limit: after a user has reacted, they can change their reaction but not add a second one.

**What gets published:** Admin reads, approves with one click, item appears on site. Expired items (`expires_at < NOW()`) are hidden from public display even if `is_published = true`.

**Auto-publish escalation (configurable, off by default):** The admin panel includes an "Auto-publish" toggle in settings (`/admin/settings`). When enabled, high-confidence intel items (`confidence = 'high'`) that have been pending for longer than a configurable delay (default: 2 hours) auto-publish without admin action. This closes the gap when Dylan is offline for 8-10 hours — high-confidence items (Tier 1 confirmed + strong reactions) don't sit dead in the queue while a flash sale expires.

**Auto-publish rules (when enabled):**
- Only `confidence = 'high'` items qualify
- Only items where `expires_at` is set AND more than 3 hours in the future at time of auto-publish (don't auto-publish something that expires in 30 minutes — it'll be dead by the time users see it)
- Items with `casino_id = null` (unmatched casino) never auto-publish
- Items with `item_type = 'platform_warning'` or `'state_intel'` never auto-publish (these require admin judgment)
- Auto-published items are tagged: `auto_published = true` (add this boolean column to `discord_intel_items`, default false) so Dylan can audit what went out without his review
- The delay is stored as `auto_publish_delay_minutes INT DEFAULT 120` in a new `admin_settings` table (single row, key-value or structured):

```sql
CREATE TABLE admin_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
-- Seed: INSERT INTO admin_settings VALUES ('auto_publish_enabled', 'false', NOW());
-- Seed: INSERT INTO admin_settings VALUES ('auto_publish_delay_minutes', '120', NOW());
```

**Implementation:** A cron-like check runs on each page load of `/admin` or can be triggered by a Vercel cron job (recommended: every 15 minutes). Query: `SELECT * FROM discord_intel_items WHERE is_published = false AND confidence = 'high' AND created_at < NOW() - INTERVAL '1 minute' * [delay] AND (expires_at IS NULL OR expires_at > NOW() + INTERVAL '3 hours') AND casino_id IS NOT NULL AND item_type NOT IN ('platform_warning', 'state_intel')`. For each qualifying row: set `is_published = true`, `published_at = NOW()`, `auto_published = true`.

**Why off by default:** Dylan needs to trust the pipeline first. He reviews everything manually until confidence scoring proves reliable. Then he flips the toggle and the 10-hour gap disappears. This is the escalation path from "I am the gate" to "the system handles routine approvals while I sleep."

**What never auto-publishes regardless of setting:** Items below `high` confidence. Items without a matched casino. Platform warnings and state intel (these require operational action, not just publishing).

**Personal URLs are never stored in `content`:** Giveaway links, personal referral URLs, and user-specific promo links must be stripped before ingestion. Platform-wide promotional URLs (casino.com/promo/spring-sale) are acceptable. When in doubt, strip the URL and describe the offer in text.

---

## The redemption state machine — implement this exactly

**When a user submits a new redemption:**
1. Create a `redemptions` row with `status = 'pending'`
2. Do NOT create a ledger entry yet
3. Show the pending redemption in the UI as "in transit" — SC has left the casino balance but cash hasn't arrived

**How casino SC balance is calculated for a user:**
```
available_sc = (sum of ledger_entries.sc_amount WHERE user_id=$1 AND casino_id=$2)
             - (sum of redemptions.sc_amount WHERE user_id=$1 AND casino_id=$2 AND status='pending')
```

**When a user marks a redemption as received:**
1. Set `status = 'received'`, set `confirmed_at = NOW()`
2. Create a `ledger_entries` row: `entry_type = 'redeem_confirmed'`, `usd_amount = +(usd_amount - fees_usd)`, `sc_amount = -sc_amount`, set `source_redemption_id`
3. The ledger entry uses net-of-fees USD. Gross and fees are on the `redemptions` row for reference.

**When a redemption is cancelled or rejected:**
1. Set status to `'cancelled'` or `'rejected'`
2. Do NOT create a ledger entry
3. SC balance restores automatically because pending deduction disappears

---

## The affiliate two-state logic — implement this exactly

**Gate is ledger-based.** If an authenticated user has ANY `ledger_entries` rows for a given casino, they've joined that casino — show a direct link. If they have no ledger entries (or are anonymous), fire the affiliate link.

```
user_has_joined(user_id, casino_id) = EXISTS (
  SELECT 1 FROM ledger_entries
  WHERE user_id = $1 AND casino_id = $2
  LIMIT 1
)
```

For anonymous users: always show affiliate link. For authenticated users: check ledger.

**Critical: simple mode tracker claims must still write a ledger entry.** Even when a user taps "Claimed" in simple mode (no SC amount entered), `/api/tracker/claim` must create both a `daily_bonus_claims` row AND a `ledger_entries` row of type `'daily'` with `sc_amount = null`, `usd_amount = 0`. This is what closes the affiliate gate. Do not skip the ledger entry because SC is null.

**When an affiliate click happens:** POST to `/api/affiliate/click` → log to `clicks` → redirect to `casinos.affiliate_link_url`. Never embed the raw affiliate URL in HTML where it can be scraped.

For casinos where `has_affiliate_link = false`: the link on the casino card goes directly to the casino site (no affiliate tracking). Show these casinos with full profiles but without the CTA styling that implies a referral benefit.

**Note on affiliate link formats:** Casinos use different tracking models. Some use query-parameter affiliate links (`casino.com?ref=sweepsintel`), others use path-based referral links (`casino.com/invite/goobspins`). The platform treats these identically — store the full URL in `casinos.affiliate_link_url`, redirect through `/api/affiliate/click`. No special handling per link format.

The daily tracker surfaces not-joined casinos below the main checklist — "Casinos you haven't claimed at yet." Every click logs to `clicks` with `referrer_source = 'tracker_suggestions'`.

---

## Feature specs

### 1. Deploy configuration (do first)

Wire `@astrojs/vercel` into `astro.config.ts`. Create `src/lib/db.ts` with the Neon connection (reads `DATABASE_URL` from env). Create `.env.example`. All Neon queries go through `src/lib/db.ts`.

---

### 2. Casino directory (public)

- `/casinos` — table/grid view. Default sort: tier ascending, then rating descending (Tier 1 highest-rated first). Think of it as a well-formatted spreadsheet — this is where SweepsIntel beats Dogbear's outdated list. Casino cards show: name, tier badge, rating, promoban risk badge, redemption speed, live games indicator.
- `/casinos/[slug]` — full casino profile. Renders MDX editorial content + structured data panel.

**Filtering:** Togglable filter chips above the list — no user-personalized or state-based filtering at MVP. Filter options: Tier (1 / 2 / 3), Promoban Risk (None / Low / Medium / High), Has Live Games (yes/no). Multiple filters can be active simultaneously. No user-level or saved filters.

**CTA placement:** Wherever the casino name appears — on cards, in tables, in any list — it is a clickable link that fires the affiliate two-state logic. The name IS the CTA. No separate "Join" button needed on the directory; clicking the casino name routes through `/api/affiliate/click` for unjoined users or directly to the casino site for joined users.

**Structured data panel on casino profile includes:**
- Tier, rating, parent company
- Promoban risk (colored badge: green/yellow/orange/red), family ban propagation warning if true
- Whether banning confiscates funds (explicit warning if true)
- Redemption: speed description, fee description, minimum amount
- Streak mode and reset time (with next reset countdown if user is authed)
- Playthrough multiplier and notes
- Live games: yes/no; if yes, which provider(s). Below the provider list, show the `casino_game_availability` table for this casino: specific games tracked, with confidence badges (high=green, medium=yellow, low=orange, unverified=gray) and cross-wash relevance flag. This is public information — knowing which games exist at a casino is free. Data is populated by the monitoring pipeline and admin edits.
- Intra-family cross-wash: does/doesn't support SC transfer, which direction (public). Detail and live game cross-wash notes paywalled.
- Live games cross-wash: yes/no + which provider(s). Compatible cross-wash partner suggestions paywalled. Required warning when live games are present: "Live game providers log multi-account connections at the same table. Separate devices and IPs are required."
- Community wash game volatility table — **post-MVP, do not build at launch** (see Feature #12). Leave a placeholder section on the profile page: "Community Volatility Reports — Coming Soon" so the layout reserves space.
- State availability notice (amber for `legal_but_pulled_out`, grey factual note for `operates_despite_restrictions`)
- Ban reports feed (published reports for this casino, sorted by date)
- Ban uptick alert banner if active
- Average redemption time stats (median, p80, trend signal, sample size)
- Affiliate CTA button (two-state logic as described above)
- **Email capture banner** (same component as homepage — non-blocking aside). Source: `'casino_profile'`. Place below the structured data panel, above the community reports section. Only shown to unauthenticated visitors.

**MDX frontmatter expansion** — add to `src/content/config.ts` Zod schema: `claimUrl`, `streakMode`, `resetTimeLocal`, `resetTimezone`, `hasStreaks`, `scToUsdRatio`, `parentCompany`, `hasLiveGames`, `cwDirection`.

**Data source precedence:** The `casinos` table in Neon is authoritative for all live operations (reset times, affiliate links, ratings, tier, promoban risk). MDX frontmatter duplicates some of these fields for editorial convenience and content collection type safety, but the database is the source of truth for all dynamic features (tracker countdown, affiliate routing, directory sort). On casino profile pages, render MDX editorial content alongside structured data pulled from the database — not from frontmatter. Same pattern as affiliate links: `casinos.affiliate_link_url` in the DB is live, `affiliateLink` in MDX is editorial reference only.

**Field precedence matrix (casino profile render):**

| Field | Source | Why |
|---|---|---|
| name, slug | DB | URL routing, display everywhere |
| tier, rating | DB | Admin-editable, sort/filter |
| promoban_risk, hardban_risk, ban_confiscates_funds | DB | Admin-editable risk profile |
| affiliate_link_url, has_affiliate_link | DB | Live click routing |
| reset_time_local, reset_timezone, streak_mode | DB | Tracker countdown calculation |
| daily_bonus_desc, daily_bonus_sc_avg | DB | Section 2 display, sort |
| redemption_speed_desc, redemption_fee_desc, min_redemption_usd | DB | Structured data panel |
| sc_to_usd_ratio, playthrough_multiplier | DB | Calculations, display |
| has_live_games, cw_direction, cw_notes | DB | Live games section |
| parent_company | DB | Display, family ban grouping |
| Editorial prose (about section, strategy notes, detailed descriptions) | MDX body | Content collection, SEO |
| claimUrl (in MDX frontmatter) | MDX | Editorial reference only — NOT used for live link routing |

**Rule: if a field exists in both MDX frontmatter and the DB, the DB value wins at render time.** MDX frontmatter serves only as (a) type-safe validation via Zod schema at build time and (b) editorial reference for content authors. The DB is always the runtime source.

---

### 3. State availability (public)

- `/states` — US map or table. Each state: legal status, number of casinos available, recent pullout alerts.
- `/states/[code]` — state detail: legal status with source, all casinos available, recent pullout events. **Email capture banner** (same shared component) for unauthenticated visitors. Source: `'state_page'`. State pages are high-intent — someone checking their state's legality is a strong conversion signal.
- Community state report submission: same IP dedup flow as ban reports (3 same-IP reports in 7 days → flagged). Reports go into `state_availability_reports` as `is_published = false` for admin review.

**State pullout alert fires from THREE paths:**
1. Admin directly updates `casino_state_availability.status = 'legal_but_pulled_out'` (single casino)
2. Admin approves a `state_availability_reports` row with `reported_status = 'legal_but_pulled_out'` (single casino or provider)
3. Admin updates a provider's state status via the provider cascade action (see Admin panel spec — affects all casinos using that provider in that state simultaneously)

Paths 1 and 2 trigger: create `state_pullout_alerts` row + create `user_notifications` rows for all users in `user_state_subscriptions` for that state. Path 3 creates ONE state-level notification per affected user (not per casino) — see provider cascade spec in Admin panel.

**Email for state pullouts:** At MVP, state pullout alerts are in-app notifications only. Email blasts for severe events are manual (admin-composed via `/admin/notifications`). `email_waitlist` entries (soft-captured, not full accounts) do NOT receive any automated alerts — they are a separate marketing funnel.

---

### 4. Ban report system (public)

**Submission requires a logged-in account (email OTP auth).** Anonymous submission is not permitted. If an unauthenticated user attempts to submit, prompt the email entry flow inline.

- Rate limit: 1 submission per report topic (casino) per user account per 7 days. Enforced per `reporter_user_id`. IP hashing is stored for audit but IP-only dedup is secondary to account-level dedup.
- IP dedup threshold (secondary): 3 same-IP reports for any casino within 7 days → `is_flagged = true`
- Uptick threshold: 5 unique-account reports for same casino within 7 days → write `ban_uptick_alerts` row + create `admin_flags` row with `source = 'ban_uptick'`
- **All reports go into manual review queue.** `is_published = false` on submission. Admin reviews and publishes via the community reports queue.
- **Confirmation message to user after submit:** "Your report has been submitted and will be reviewed before publishing. Thank you."
- Published reports appear on casino detail page
- Uptick alert shows as a banner: "⚠️ Elevated ban activity reported in the last 7 days"
- Users can report: promoban, hardban, account review, fund confiscation (maps to `report_type` values: 'promoban', 'hardban', 'account_review', 'fund_confiscation')

Apply the same submission rules (account required, 1 per topic per 7 days, manual review queue, confirmation message) to: `state_availability_reports` and `reset_time_suggestions`. (`game_volatility_reports` uses the same pattern but is post-MVP — see Feature #12.)

---

### 5. Daily tracker (private, auth required)

Route: `/tracker`

The tracker is a React component (`client:load`). Two distinct sections on the same page.

---

**Section 1: Your Casinos (top)**

Casinos where the user has a `user_casino_settings` row with `removed_at IS NULL`. These are "their" casinos. This includes both `source = 'admin'` (curated, has a profile) and `source = 'user_suggested'` (user added a casino not in our directory). Both appear in Section 1. User-suggested casinos show the casino name and claim controls but no profile link (no profile exists yet).

**Adding a casino not in the directory:** Users can type any casino name into a search/add field in the tracker. If the name matches an existing `casinos` row (case-insensitive name lookup), use that row. If no match, create a new `casinos` row with `source = 'user_suggested'`, `has_affiliate_link = false`, `is_excluded = false`, and a generated slug. Then create the `user_casino_settings` row. Do not duplicate — check for existing `user_suggested` rows with the same name before creating a new one. The admin dashboard will surface these for review (see Admin panel spec).

**Bulk import:** Users can upload a `.txt` or `.csv` file with casino names (one per line) to add multiple casinos to their tracker at once. `POST /api/tracker/bulk-import` accepts a file upload, parses each line, and runs the same add-casino logic per name: match existing → create `user_casino_settings`; no match → create `user_suggested` casino + `user_casino_settings`. Return a summary: "Added 8 casinos to tracker. 3 matched existing profiles, 5 are new suggestions pending review." This is critical for power users who track 10-20+ casinos — adding them one by one is a bounce-worthy activation barrier. Skip blank lines and duplicates. If a casino is already in the user's tracker (`removed_at IS NULL`), skip it silently.

**Default sort:** Available-now casinos float to the top (reset has passed, not yet claimed today). Below those: ascending time-to-reset (soonest expiring first). Claimed-today casinos sink to the bottom with a ✓. This ensures the most urgent action is always at top.

**User can drag-reorder** their casinos to override the default sort. Drag order persists in `user_casino_settings.sort_order`. When sort_order is set for at least one casino, use sort_order as primary key (with available-now still floating above locked rows). A "Reset sort" option restores default time-based sort.

**Per casino row:**
- Casino name (clickable → casino profile, not affiliate link for joined users)
- Reset countdown (see logic below)
- Streak counter if `casinos.has_streaks = true`
- Today's claim status

**Claim interaction — simple mode:**
A single "Claimed" button. Tapping it does three things atomically via `POST /api/tracker/claim`:
1. Creates a `daily_bonus_claims` row (`claim_type = 'daily'`, `sc_amount = null`)
2. Creates a `ledger_entries` row (`entry_type = 'daily'`, `sc_amount = null`, `usd_amount = 0`, `source_claim_id` = the new claim ID)
3. Resets the timer and increments the streak

**The ledger entry in step 2 is critical.** It closes the affiliate gate for this casino (see affiliate two-state logic). Without it, the user could claim daily for weeks and still see affiliate links for a casino they obviously joined. Do not skip the ledger entry because SC is null.

No SC entry required from the user. The button label changes to "✓ Claimed" and the row moves to the bottom of the section.

**Claim interaction — advanced mode:**
"Claimed" button → immediately shows an inline entry below the row (no modal, no page navigation):
- SC amount number field (empty, not prefilled)
- "No SC today" button

Both paths commit the claim, reset the timer, continue the streak. "No SC today" logs `sc_amount = 0`. Entering a number and tabbing/blurring commits it. No explicit save button — the action is the commitment. After commit, inline collapses and the row moves to the bottom of the section with "✓ Claimed" label.

**The "No SC today" case is important:** The user DID claim — their clock resets, their streak continues — they just received zero SC. This is NOT the same as failing to claim (which would produce a gap in `daily_bonus_claims` and break the streak for casinos with `has_streaks = true`). The distinction must be tracked, not inferred.

**Streak break detection:** For casinos with `has_streaks = true`, if the gap between `last_claim.claimed_at` and the next available window exceeds 48 hours (generous buffer), the streak counter resets to 0. Display this on the row.

---

**Section 2: Casinos to Add (bottom)**

Admin-curated casinos (`source = 'admin'`, `is_excluded = false`) where the user has NO active `user_casino_settings` row (i.e., no row exists OR the row has `removed_at IS NOT NULL`). A casino the user previously removed reappears here — soft-delete returns it to the temptation shelf. These are the temptation shelf. User-suggested casinos and excluded casinos never appear here — only the platform's curated directory.

**Sort:** Highest expected daily SC at top. Use real aggregated data where it exists, admin-set seed as fallback:
```sql
COALESCE(
  AVG(dbc.sc_amount) FILTER (WHERE dbc.sc_amount > 0),
  c.daily_bonus_sc_avg
) AS sort_sc
FROM casinos c
LEFT JOIN daily_bonus_claims dbc ON dbc.casino_id = c.id
GROUP BY c.id
ORDER BY sort_sc DESC NULLS LAST
```
`daily_bonus_sc_avg` is the admin-seeded value at casino intake. Once real claim data flows in, actual averages override it automatically. No manual maintenance required long-term.

**Per card:**
- Casino name (clickable → casino profile)
- `casinos.daily_bonus_desc` (platform-level text like "~200-400 SC/day")
- Two CTAs:
  - **"Join"** — fires affiliate click AND creates `user_casino_settings` row atomically → moves casino to Section 1. Use this CTA when `has_affiliate_link = true`. **Implementation: `POST /api/tracker/add-casino` with `{ casino_id, fire_affiliate: true }`.** The `add-casino` endpoint handles both actions in a single request: logs the click to `clicks` (with `referrer_source = 'tracker_suggestions'`), creates the `user_casino_settings` row, and returns the `affiliate_link_url` for client-side redirect. This must be atomic — if the settings row creation fails, the click should not be logged. Do not split this into two separate API calls from the client.
  - **"Add to tracker"** — creates `user_casino_settings` row without firing affiliate click → moves casino to Section 1. **Implementation: `POST /api/tracker/add-casino` with `{ casino_id, fire_affiliate: false }`.** Same endpoint, different behavior. Show this as secondary link text ("Already a member? Add to tracker") below the Join button, or as the primary CTA when `has_affiliate_link = false`.

---

**Reset countdown logic — use Luxon, no alternatives:**

Replicate `computeCasinoResetSummary` from `Casino/web/lib/v2/casinoReset.ts` in `src/lib/reset.ts`.

- `streak_mode = 'fixed'`: parse `reset_time_local` as `HH:MM`, use `reset_timezone` as IANA zone. Compute today's reset moment. If current time is past it, next reset is tomorrow at the same time. If before it, next reset is today. Luxon handles DST automatically.
- `streak_mode = 'rolling'`: next available = `last_claim.claimed_at + 24 hours`. If no prior claim: "Available now."
- Unknown mode: "Reset time unknown — check the casino site." Link to submit a reset time suggestion.

User timezone from `user_settings.timezone`. Never infer from IP.

**Tracker membership vs. affiliate gate — these are separate:**
- `user_casino_settings` row = "this casino is in my tracker" (Section 1 membership)
- `ledger_entries` EXISTS = "I've transacted here" (affiliate CTA suppression gate)
A user can be in Section 1 (tracker member) without having any ledger entries (e.g. they just joined but haven't logged anything). The affiliate link should still be suppressed once they tap "Join" — log the click in `clicks` at that moment as the attribution event.

---

### 6. Redemption tracker (private, auth required)

Route: `/redemptions`

- List of all redemptions, filterable by status, sortable by date
- Submit Redemption modal: casino, SC amount, USD amount, fees, method, bank note, notes
- Per pending redemption: casino, amounts, method, submitted date, elapsed time indicator, average redemption time for this casino (from public stats)
- **Redemption slowdown alert:** If the casino's recent 30d median redemption time shows a >20% increase (trend signal from `redemption-stats.ts`), show a critical alert banner on this page next to the pending redemption: "⚠️ Processing times at [Casino] appear to be increasing recently." Passive display only — no push notification.
- Actions: **Mark Received**, **Cancel**, **Reject**
- "In Transit" balance at top: total USD pending

---

### 7. Ledger (private, auth required)

Route: `/ledger`

**Simple mode** (`user_settings.ledger_mode = 'simple'`):
- Shows all ledger entries
- Summary: total USD in (redemptions), total USD out (offer purchases), net P/L
- Does NOT show SC balance prominently — just as informational
- Manual entry form only shows USD-facing entry types (adjustment, offer, redeem)
- Prompt to daily claims is "log SC amount" — stores it but doesn't require it for P/L

**Advanced mode** (`user_settings.ledger_mode = 'advanced'`):
- Full SC balance display per casino
- SC balance = sum of ledger sc_amount - pending redemptions sc_amount
- Session linking via `link_id` (future: wash session logs)
- Full entry type menu including wager/winnings

**Both modes:**
- Per-casino P/L breakdown
- Paginated (20/page), filterable by casino, type, date range
- CSV export
- P/L formula: `net_pl_usd = SUM(usd_amount)` where usd_amount is positive for money in, negative for money out. Nothing else.
- No tax fields, no tax math, no tax language. P/L is money in minus money out.

Mode can be toggled in settings. Switching preserves all data — only display changes.

---

### 8. Auth (email OTP)

Routes: `POST /api/auth/request-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/logout`

6-digit OTP, 15-minute expiry. Store hashed in `auth_sessions.otp_token_hash`. On verify: set `session_token` cookie (HttpOnly, Secure, SameSite=Strict), 90-day expiry. **Session expiry is rolling:** on every authenticated request, update `auth_sessions.last_active_at = NOW()`. Session is valid as long as `last_active_at` is within 90 days. This means active users never get logged out. Inactive users (90+ days since last visit) must re-authenticate. Follow security best practices but lean generous — users shouldn't be re-prompted constantly.

**Post-login redirect:** After successful OTP verification, redirect to `/tracker`. This is the user's "home screen." All authenticated sessions start here. The nav should visually indicate `/tracker` as active.

On first verify: prompt for home state → populates `user_state_subscriptions`. **Also on first verify:** check `email_waitlist` for a matching email. If found, update the row: `converted_user_id = [new user_id]`, `converted_at = NOW()`. This links the waitlist capture to the converted account for funnel analytics (which capture source converts best).

Admin check: middleware reads `user_settings.is_admin` — admin routes reject non-admin sessions.

**OTP prompt strategy — two distinct entry points:**

1. **Private tools (tracker, ledger, redemptions):** Do NOT show a login wall upfront. Let the user browse freely. The auth prompt triggers when the user first attempts to enter data — for example, when they tap "Claimed" on a casino row or start a ledger entry. Show an inline nudge at that moment: "Make sure your data gets saved — just enter your email." This captures intent while removing friction for casual browsers.

2. **Public / info pages:** Show a lightweight newsletter-style email capture prompt (non-blocking — a banner or aside, not a modal). Copy: something like "Get state pullout alerts and ban intel in your inbox." This pipelines casual visitors toward conversion without forcing them into full auth. Captured emails before OTP verification are stored separately as `email_waitlist` (simple table: email, captured_at, source) — they are not `user_settings` rows yet. Do NOT create a user account from a newsletter capture alone.

---

### 9. In-app notification panel (private, auth required)

Route: `/notifications`
Nav: bell icon with unread count badge (red dot if > 0)

- List of all `user_notifications` for the user, sorted by newest first
- Unread items visually distinct
- Click-through via `action_url` to relevant page
- "Mark all as read" button
- Notification types displayed:
  - `state_pullout`: "⚠️ [Casino] has stopped accepting players in [State]"
  - `ban_uptick`: "🚩 Elevated ban reports for [Casino] in the last 7 days"
  - `system`: generic platform messages
- **`redemption_slow` is NOT a notification type.** It does NOT create `user_notifications` rows. It is a passive visual banner only — displayed on casino profile pages and the redemptions page when the trend signal is active. See Feature #6 for display rules.

**Notification creation rules — two scoping principles:**

**Principle 1: State-level alerts are universal within that state.** If you live in Ohio, you see every state-relevant signal for Ohio — pullouts, provider exits, legal changes — regardless of which casinos you track. These are defensive intel. You don't need to play at a casino to care that it's leaving your state or that a provider is exiting.

**Principle 2: Casino-level signals are scoped to tracker members.** Promo codes, flash sales, ban upticks, redemption slowdowns — these only display for users who have that specific casino in their `user_casino_settings`. If you don't track DimeSweeps, DimeSweeps intel is invisible to you. This keeps individual feeds clean, makes it viable to publish niche casino intel (only the 4 people tracking it see it), and creates a natural incentive to expand your tracker — your intel surface area grows with your casino list.

**Per notification type:**

- **State pullout** → `user_notifications` for ALL users with `user_state_subscriptions.state_code = [state]`. Universal within state. Does not filter by casino tracker. Same logic applies to provider state exits (e.g. Pragmatic Play pulling from MI affects cross-wash at every casino using Pragmatic in MI — notify all MI subscribers).

- **Ban uptick** → `user_notifications` for users who have that casino in `user_casino_settings` (tracker members). NOT ledger-based. If you're actively tracking a casino, you care about ban activity there. If you stopped tracking it, you don't need the noise.

- **Redemption slow** → NOT a push notification at MVP. Instead, show a visual critical alert banner on the casino profile page, the redemptions page (for pending redemptions at that casino), and the admin dashboard. The trend signal from `redemption-stats.ts` creates an `admin_flags` row — Dylan reviews and decides whether to take action. Users see the alert passively when they visit relevant pages. No email, no notification fan-out. Keep it simple.

- **Discord intel items (promo codes, flash sales, free SC, playthrough deals, general tips)** → these are NOT push notifications. They display on the user's `/tracker` page in a personalized "My Alerts" section, filtered to casinos in the user's `user_casino_settings`. If you don't track DimeSweeps, a DimeSweeps flash sale is invisible to you. This also means small/niche casinos can have intel items published without cluttering the feed for users who don't play there. **Exception:** Items with `casino_id = null` (general alerts not tied to a specific casino, e.g. "March Madness flash sales across all platforms") display for all logged-in users.

- **System notifications** → created manually by admin, targeted by segment (all users / state / casino).

---

### 10. Homepage

`/` — the marketing surface for new players.

- Headline + subheadline: what SweepsIntel is
- **Two primary CTAs:** "Start earning today" → `/getting-started` (new players) and "Open tracker" → `/tracker` (existing players). The Getting Started guide is the highest-converting page for new visitors — it MUST be the primary CTA for first-time visitors, not the casino directory. Directory is discoverable from nav and from within the guide.
- Active state pullout alerts — if any `state_pullout_alerts` fired in last 30 days, show them prominently (proof of value)
- Active ban uptick alerts — recent ban activity
- Top-rated casinos grid: top 6 casinos WHERE `tier = 1 AND rating IS NOT NULL` ORDER BY `rating DESC`. If fewer than 6 Tier 1 casinos have ratings, fill remaining slots with Tier 2 casinos by rating. Casinos with NULL rating are excluded from this grid (they can still appear in the full directory).
- External community link: plain link to Dogbear's SweepstakeSideHustle Discord (https://discord.gg/9CgSgJHFu8). No embed, no widget — just a styled link card. "Join the community →"
- No Discord embed of any kind.
- **Email capture banner** (non-blocking — inline banner or aside, NOT a modal). This is the public-facing `email_waitlist` funnel described in Feature #8 OTP prompt strategy entry point 2. Copy: "Get state pullout alerts and ban intel in your inbox" or similar. Captures email → stores in `email_waitlist` with `source = 'homepage_banner'`. Does NOT create a `user_settings` row or trigger OTP. This is the homepage's conversion hook for casual visitors who aren't ready to create an account. Place below the hero section, above or alongside the top-rated casinos grid.

---

### 11. Getting Started guide (public, featured editorial)

Route: `/getting-started`

A single static editorial page — the highest-converting page on the platform. Designed for someone who has heard about sweepstakes casinos but never signed up. Written by Dylan, formatted by Codex.

**Structure:**
1. What sweepstakes casinos are and why they're legal (plain English)
2. What SC and GC are (SC = the redeemable currency, GC = the sweepstakes "play money" that lets you earn SC)
3. The complete first-day loop with one specific casino: sign up → verify ID → purchase the welcome offer → play [specific game] at [specific bet size] → submit a redemption → receive money
4. Key terms defined in-context as they appear (playthrough, wash, SC-to-USD ratio)
5. Common new player mistakes (don't skip ID verification, don't ignore playthrough before redeeming)
6. Next steps: add more casinos, use the daily tracker

**Casino selection:** MyPrize. Criteria met: instant redemptions (a major differentiator), wide slot + live game catalog, low promoban risk, VIP system, strong daily reward with streak mechanic, celebrity brand recognition, wide state availability. Referral code: `goobspins` — affiliate link: `https://myprize.us/invite/goobspins`.

**MyPrize-specific guide notes (editorial, not schema):**
- Referral program is SC-based not USD CPA: Level 1 (referred user purchases $19.99+) = 100K GC + 20 SC to referrer; Level 2 (referred user reaches $999.99+ total) = 400K GC + 80 SC to referrer.
- Welcome offer sequence on day 1 is extensive: multiple tiered offers (Welcome Offer 1-4 + Flash Offer + Email Offer). The Getting Started guide should recommend starting with the smallest welcome offer first to understand the mechanics before committing more.
- Playthrough system is batched: each batch of SC has its own independent 1x playthrough tracker shown separately in a list (not a single aggregated counter). This is unusual and needs to be explained in the guide — it looks more complex than it is. Each batch must be washed independently in order.
- **Wash game for the guide is TBD — Pigsby is NOT confirmed as the recommendation.** Dylan needs to research the best wash game to recommend to a new user. The guide must name a specific game, bet size, and expected spin count. Leave a clear `TODO: wash game recommendation` comment in the guide template. Do not publish until filled in.
- Guide must include the playthrough step explicitly: "check your Playthrough screen, find the active batch, play [GAME] at [BET SIZE]/spin until that batch reaches 100%."

**Design:** Long-form editorial prose, explicit step-by-step with screenshots at each key step (sign up screen, ID verify screen, welcome offer purchase screen, playthrough tracker screen, redemption submit screen, redemption received confirmation). Screenshots are placeholders at build time — leave `[SCREENSHOT: description]` markers in the MDX where they go. Minimal UI chrome. Highly SEO-optimized (`/getting-started` as standalone route). This page earns the affiliate click at the bottom.

---

### 12. Community game volatility reports — POST-MVP

**This feature is deferred from the MVP build.** The database schema (`game_volatility_reports` table, `game_providers` table, `casino_live_game_providers` junction) is already defined above and MUST be created with the initial schema migration — do not skip the tables. But do NOT build the submission form, admin review queue tab, aggregation logic, or casino profile display table at MVP.

**Why deferred:** At launch there will be zero reports. The volatility table would show "Insufficient data" on every casino profile, adding noise to the UI with no value. Build this when the platform has 50+ active tracker users generating enough reports for consensus to be meaningful.

**What to build now:** Nothing. The `VolatilityTable.tsx` component, `VolatilityReportForm.tsx`, `volatility-submit.ts` endpoint, `volatility.ts` lib, and the "Volatility Reports" tab in the admin reports queue are all deferred. Keep them in the file structure as comments or placeholders so the architecture is visible, but do not implement.

**What to build later (reference spec for future Codex session):**

**Submission** (auth required — account required, same as all community reports):
- User can submit a volatility report for any game at any casino they have ledger entries for
- Form fields: game name (text + optional provider dropdown), volatility (Low / Medium / High), optional community RTP observation (labeled explicitly: "This may not reflect the casino's current settings"), optional notes
- One report per user per game per casino per 7 days (prevent flooding — enforced by `reporter_user_id`)
- Trust score snapshot stored with report
- All reports enter manual review queue (`is_published = false`). Confirmation message to user: "Your report has been submitted and will be reviewed before publishing. Thank you."

**Display** (public on casino profile):
- Per casino, show a table: Game Name | Provider | Community Volatility | Reports
- Consensus volatility = weighted mode (weight = trust_score_at_report). Show "Disputed" if no clear consensus.
- Show "X community reports" count
- Bold disclaimer above table: "Volatility is community-reported and weighted by reporter trust. RTP values shown reflect community observations only — casinos can and do change game settings without notice."

**Trust scoring** (simple implementation):
- Default trust_score = 1.0 for all users
- Trust score updates are manual (admin-adjustable) initially
- Future: auto-adjust based on report corroboration patterns

---

### 13. Admin panel (admin auth required)

Route prefix: `/admin`

This is the Collective operations interface. It must be fast — Dylan is a 5-second reviewer, not a full-time editor.

**Design principles for the admin UI:**
- **Queue-driven.** The dashboard is a single screen showing everything that needs attention. Dylan opens it, sees counts, works through queues top to bottom. Zero navigation required for the 80% case.
- **One-click actions.** Every queue item has approve/reject/dismiss as direct action buttons on the row — no "open detail page then find the button." Destructive actions (publish a report, fire an alert) get a lightweight confirmation modal, but the modal must pre-fill all required fields from context. Dylan should never have to re-type information that's already in the flag.
- **AI summaries front and center.** For discord-sourced flags, the `ai_summary` is the first thing displayed — not buried below raw content. Dylan reads the one-liner, glances at the proposed action, and clicks. Raw `flag_content` is expandable for full context but collapsed by default.
- **Keyboard shortcuts for power use.** `a` = approve/act, `d` = dismiss, `n` = next item, `p` = previous. The queue should be navigable without a mouse once Dylan enters the flow. This is what makes 5-second reviews possible.
- **Inline editing.** Casino tier, rating, promoban_risk, redemption_speed_desc are editable directly in the casino list — click the cell, type, tab to save. No "open edit page" round-trip for common field updates.
- **Batch processing.** When multiple flags of the same type stack up (e.g., 5 ban reports for the same casino), allow selecting multiple and acting on them as a batch. One publish action for all 5 rather than 5 individual clicks.
- **Visual priority.** Flag types should be color-coded or badge-styled so Dylan can visually scan the queue for high-priority items (state pullouts > ban surges > redemption slowdowns > data anomalies). Discord-sourced flags with AI summaries should be visually distinct from raw auto-detected flags.

**Dashboard** (`/admin`):
- Queue counts: pending ban reports, pending state reports, pending reset suggestions, pending volatility reports, unresolved admin flags, unpublished discord intel items, **user-suggested casinos pending review** (count of `casinos` rows where `source = 'user_suggested'`)
- Recent admin flags (last 10 — shows ai_summary when present, raw flag_content otherwise)
- Recent discord intel items pending review
- Recent state pullout alerts
- System health: active users (7d), pending redemptions count, ban uptick active count

**Casino CRUD** (`/admin/casinos`):
- Table of all casinos with edit links. **Filter tabs: Admin-curated | User-suggested | Excluded**
- "New Casino" form with all fields from the `casinos` schema
- Inline quick-edit for tier, rating, promoban_risk, redemption_speed_desc
- Live game providers management (checkboxes to assign providers to casino)
- **Game availability management:** Below the provider checkboxes, show a table of `casino_game_availability` rows for this casino. Columns: Game Name | Provider | Type | Cross-wash? | Confidence | Positive/Negative signals | Status. Admin can: add games manually (name, provider, type, cross-wash flag), edit status (available/removed), toggle `is_cross_wash_relevant`. Most rows will be auto-populated by the monitoring pipeline — admin's job is verification and correction, not data entry. Show a count badge on the casino edit page: "12 games tracked (3 cross-wash)" for quick reference.
- Per-casino: one-click "flag for review" — creates an `admin_flags` row with `source = 'manual'` and `flag_type = 'data_anomaly'` so it surfaces in the flags queue before publishing
- **User-suggested casino actions:** For `source = 'user_suggested'` rows, show: tracked-by count ("3 users tracking this"), **"Build Profile"** button (promotes to `source = 'admin'`, opens full edit form), **"Exclude"** button (sets `is_excluded = true`). This is the affiliate expansion demand signal — high tracked-by counts tell Dylan which casinos to prioritize for affiliate enrollment.

**Admin flags queue** (`/admin/flags`):
- List of pending `admin_flags` rows, sorted by created_at
- Each flag shows: source, flag_type, casino/state if relevant, raw `flag_content`, and `ai_summary` + `proposed_action` when present
- **Discord-sourced flags will have `ai_summary` and `proposed_action` populated** by the monitoring script at ingest time. When the monitoring pipeline POSTs to `/api/discord/ingest` with `admin_flag: true`, the payload includes a one-line AI summary and a proposed action (e.g., "LoneStar redemptions slowing — 3 reports in 24h" / "Update redemption_speed_desc + monitor"). Dylan reads these to make fast decisions. **Nothing auto-acts — Dylan's click is always required.**
- **Flags from automated detection** (ban uptick, trend signals) are created by in-app logic with no AI summary — admin reads raw `flag_content` directly for these. No background LLM workers. No async AI processing of user-submitted reports.
- Action buttons: **Act** (triggers relevant action — opens modal to confirm the action), **Dismiss** (mark dismissed with optional note)

**Act button behavior per `flag_type`:**

| flag_type | Act button opens | On confirm |
|---|---|---|
| `potential_pullout` | Modal: confirm casino + state + new status dropdown | Updates `casino_state_availability`, fires pullout alert flow |
| `ban_surge` | Modal: pre-filled casino name, checkboxes for "Update promoban_risk tier" and "Create ban_uptick_alert" | Updates casino risk field and/or creates alert row |
| `redemption_slowdown` | Modal: pre-filled casino, current vs. flagged redemption speed | Updates `redemption_speed_desc` on casino if admin agrees the speed has changed |
| `data_anomaly` | Modal: shows flag content, free-text "admin action taken" field | Logs the admin's note, marks flag resolved. No automated side effect — this is a catch-all. |
| `new_casino_signal` | Modal: "Create casino profile?" with pre-filled name from flag content | Creates `casinos` row with `source = 'admin'`, opens edit form for full profile build |
| `premium_content_candidate` | Modal: "Save to premium content queue?" with tag/category selector | Saves to a `premium_content_notes` text field on the flag (future: premium content system). At MVP, this just bookmarks it for Dylan's reference. |
| `positive_redemption` | No modal. Single-click dismiss with auto-note: "Noted — positive signal" | Marks flag dismissed. No database side effect. This is informational. |
| `game_availability_change` | Modal: shows casino + game name + signal counts, "Confirm removal?" toggle | If confirmed: updates `casino_game_availability.status = 'removed'`. If not: dismisses flag, signal counts persist for future monitoring. |
| `broken_platform_feature` | Modal: pre-filled casino, free-text "status update" field | Logs note on flag. No automated side effect — Dylan monitors manually and updates casino profile if needed. |

Flags with unknown `flag_type` values (the field is VARCHAR, not an enum — the monitoring pipeline may introduce new types): show raw `flag_content` with a generic "Dismiss with note" action only. No automated side effects.

**Community reports queue** (`/admin/reports`):
- Tabs: Ban Reports | State Reports | Reset Suggestions (Volatility Reports tab is post-MVP — do not build)
- Each row: submission content, reporter (hashed IP + user_id if authed), flagged status, publish/reject buttons
- Reject: requires no additional action
- Publish (ban report): sets `is_published = true`, appears on casino profile
- Publish (state report with `legal_but_pulled_out` status): triggers pullout alert flow
- Publish (reset suggestion): updates `casinos.reset_time_local` + `casinos.reset_timezone`
- All publish/reject actions log to `admin_flags` with `source = 'manual'` for audit trail

**State availability management** (`/admin/states`):
- Per-casino-per-state status table
- Inline update: dropdown to change status → on save if new status is `legal_but_pulled_out`, auto-fires pullout alert

**Provider state availability management** (`/admin/states` — second tab or section):
- Per-provider-per-state status table (from `provider_state_availability`)
- Inline update: dropdown to change provider status for a state
- **Cascade action:** When a provider's status changes to `restricted` for a state, the admin panel shows a confirmation modal: "This affects [N] casinos using [Provider] in [State]: [casino list]. Update all affected casino state availability?" On confirm:
  1. For each casino linked via `casino_live_game_providers` to this provider in this state: update `casino_state_availability.status` if appropriate (e.g. if the casino's only live game provider in that state is the one leaving, mark it `legal_but_pulled_out`)
  2. Create ONE `state_pullout_alerts` row referencing the provider (not per-casino)
  3. Create ONE `user_notifications` row per affected user in that state (via `user_state_subscriptions`) — state-level notification, not per-casino. Message: "⚠️ [Provider] has stopped serving [State] — this affects [casino list]"
  4. The notification is state-scoped per Principle 1: all state subscribers see it regardless of which casinos they track
- **Provider data is primarily user-reported at MVP.** Admin seeds initial known data, but most provider state availability updates will come from community reports. Users in affected states are the first to notice when a provider disappears — they just can't confirm whether it's a state-level issue or an account-level issue. Multiple reports from different users in the same state confirming the same provider loss is the signal. Consider adding `provider_id` as an optional field on `state_availability_reports` so users can report provider-level exits directly.

**Notification controls** (`/admin/notifications`):
- Compose system notification (title, message, action_url, user segment: all users / users in state / users at casino)
- Send → creates `user_notifications` rows for target segment
- Email blast option (for severe events): generates draft email, requires explicit send confirmation

**Discord intel queue** (`/admin/discord`):
- List of pending `discord_intel_items` rows (`is_published = false`), newest first
- Each row shows: item_type badge, casino if relevant, title, content preview, expires_at, **confidence badge** (color-coded: high=green, medium=yellow, low=orange, unverified=gray), **confidence_reason** text
- Sort: confidence descending (high first), then created_at descending within each confidence tier. High-confidence items are fast approvals; low/unverified need more review.
- Actions: **Publish** (sets `is_published = true`, sets `published_at`) | **Discard** (delete or soft-delete)
- No AI processing. Admin reads raw sanitized content, glances at confidence + reason, and decides.

---

### 14. Discord intel feed (three surfaces)

Published `discord_intel_items` surface in three places, each with different scope and auth requirements.

---

**Surface A: Tracker "My Alerts" section (private, auth required)**

Rendered inside the `/tracker` React component, **between Section 1 (your casinos) and Section 2 (casinos to add)**. On mobile: full-width block. On desktop: full-width block between sections (not a sidebar — the tracker is a single-column layout on all breakpoints for scannability). Shows published, non-expired intel items **filtered to casinos in the user's `user_casino_settings`**. This is the primary intel surface for logged-in users.

- Query: `WHERE casino_id IN (SELECT casino_id FROM user_casino_settings WHERE user_id = $1) AND is_published = true AND (expires_at IS NULL OR expires_at > NOW())`
- If no items for the user's casino list: show nothing (no empty state needed — absence is fine).
- Items are ordered newest-first.
- This is deliberately narrow. If you don't track DimeSweeps, you never see a DimeSweeps promo. Keeps the tracker signal-to-noise high. Also makes it viable to publish intel for niche casinos with small user bases — only their trackers see it.
- Items with `casino_id = null` (general alerts not tied to a casino) show here for all logged-in users.

**Surface B: Casino profile page (public, no auth required)**

If published, non-expired intel items exist for a specific `casino_id`, show them in a "Community Intel" callout on that casino's `/casinos/[slug]` profile page. Visible to anyone, including anonymous visitors. Gives a reason to return to profile pages and demonstrates the platform is active.

**Surface C: Homepage teaser (public, no auth required)**

Show the last 3 published non-expired items regardless of casino. Type badge (Free SC / Playthrough Deal / Alert) + title + casino name if relevant + "Posted X hours ago." Not personalized — this is a marketing surface showing the platform has live signal. Casual visitors see proof of value before signing up.

---

**Display rules (all surfaces):**
- Hide items where `expires_at < NOW()` even if `is_published = true`
- No Discord attribution anywhere. Source label is "Community Intel" or "Today's Alerts." The platform is the source, not Discord.
- Show `confirm_count` and `dispute_count`. Label adapts by `item_type`: promo codes / flash sales → "✓ N confirmed working · ✗ N disputed"; state intel → "✓ N users confirmed in their state"; general tips → "✓ N found this helpful."
- Auth required to react. Reaction button: "✓ Confirm" | "✗ Dispute." One reaction per user per item, changeable.

**Verification mechanic:** Community confirm/dispute turns admin-curated intel into community-validated intel over time. A promo code with 12 confirms is actionable. One with 0 confirms and 3 disputes is a warning signal.

**No public submission form.** Admin-curated only. Not a community report system.

**API ingest endpoint** (`POST /api/discord/ingest`): API-key gated (bearer token, key in env as `DISCORD_INGEST_KEY`).

Accepts a JSON body:
```json
{
  "item_type": "flash_sale",           // required — one of the item_type enum values
  "casino_slug": "mcluck",             // optional — endpoint resolves to casino_id; if no match, stores raw name in casino_name_raw
  "title": "McLuck VIP flash sale...", // required
  "content": "...",                    // required — must already be sanitized (no usernames, no Discord attribution)
  "source_channel": "bearcave_chat",   // required — 'free_sc' | 'bearcave_chat'
  "expires_at": "2026-03-14T23:59:00Z", // optional — omit for tips/warnings
  "admin_flag": true,                  // optional — if true, ALSO creates an admin_flags row (not instead of)
  "ai_summary": "McLuck running 40% off VIP packages until midnight", // required when admin_flag: true
  "proposed_action": "Publish to intel feed + update flash_sale expiry", // required when admin_flag: true
  "confidence": "high",               // required — 'high' | 'medium' | 'low' | 'unverified'
  "confidence_reason": "Tier 1 confirmed + 5 positive reactions" // required — one-line explanation for Dylan's fast review
}
```

**New fields — `confidence` and `confidence_reason`:** Every item from the monitoring pipeline carries a confidence assessment. `confidence` is one of `'high'`, `'medium'`, `'low'`, `'unverified'`. `confidence_reason` is a human-readable one-liner explaining how confidence was determined (e.g., "Single Tier 2 report, no corroboration yet" or "3 independent confirmations + 6 positive reactions"). These are stored on the `discord_intel_items` row and displayed in the admin queue to support Dylan's fast-review workflow. **See `MONITORING-SPEC-v1.md` in this directory for the full confidence scoring model, trust tier architecture, signal filtering rules, and two-stage pipeline design.**

**Casino slug resolution:** Endpoint looks up `casino_slug` in `casinos.slug`. If matched: sets `casino_id`. If not matched: leaves `casino_id = null`, stores the slug string in `casino_name_raw` for admin to manually link.

**`admin_flag: true` behavior:** Creates BOTH a `discord_intel_items` row AND an `admin_flags` row. The intel item lands in the admin publish queue. The flag lands in the flags queue with the ai_summary and proposed_action for Dylan's fast-approve flow. These serve different purposes and are not mutually exclusive. For `platform_warning` and `state_intel` types, `admin_flag` should almost always be `true` — they require a platform action AND may be worth publishing once that action is taken.

All items created as `is_published = false`. Admin reviews both queues and publishes independently.

**Game availability signal endpoint** (`POST /api/discord/game-availability`): Same API-key gate as the main ingest endpoint (`DISCORD_INGEST_KEY`).

Accepts a JSON body (array — multiple signals per scan):
```json
[
  {
    "casino_slug": "chanced",               // required — resolved to casino_id same as main ingest
    "game_name": "Iconic 21 BJ",            // required
    "provider_slug": "evolution",            // optional — resolved to provider_id
    "game_type": "blackjack",               // optional — 'blackjack' | 'roulette' | 'baccarat' | 'slots' | 'dice' | 'other'
    "signal_type": "positive",              // required — 'positive' | 'negative'
    "is_cross_wash_relevant": true           // optional — defaults to false. Opus sets this when the context involves cross-wash discussion.
  }
]
```

**Endpoint behavior per signal:**
1. Resolve `casino_slug` → `casino_id`. If no match, skip signal (game availability without a matched casino is useless).
2. UPSERT into `casino_game_availability` on `(casino_id, game_name)`.
3. If positive: increment `positive_signal_count`, update `last_confirmed_at`. If row was `status = 'removed'`, flip to `status = 'unconfirmed'` and reset `negative_signal_count = 0`.
4. If negative: increment `negative_signal_count`, update `last_negative_at`.
5. Recalculate `confidence` per the scoring rules in the schema.
6. If `negative_signal_count >= 2`: auto-create `admin_flags` row with `flag_type = 'game_availability_change'`.

---

### 15. Retention and re-engagement mechanics

**The platform must aggressively embed itself into users' daily workflow.** Passive availability is not enough — users will forget to check a website. The tracker is only useful if people come back every day. These mechanics exist to make SweepsIntel the first thing a user thinks of when their casino resets.

---

**PWA manifest (Progressive Web App):**
Create a `manifest.json` with `"display": "standalone"`, appropriate icons, `"start_url": "/tracker"`, `"theme_color"` matching the primary blue. Register a service worker at minimum for the manifest (full offline support is not required at MVP, but the manifest enables "Add to Home Screen" on mobile). This is the single highest-impact retention mechanic — a home screen icon that opens directly to the tracker.

**"Add to Home Screen" prompt:**
On the third visit to `/tracker` (tracked via a cookie counter `sweepsintel_visit_count`), show a non-blocking banner at the top of the page:

```
┌──────────────────────────────────────────┐
│ 📱 Add SweepsIntel to your home screen  │
│ for one-tap access to your tracker.     │
│ [Add now] [Maybe later]                 │
└──────────────────────────────────────────┘
```

- "Add now" triggers the browser's native `beforeinstallprompt` event (Chrome/Edge) or shows platform-specific instructions (Safari/iOS: "Tap Share → Add to Home Screen")
- "Maybe later" dismisses and suppresses for 7 days
- Never show on first visit (too aggressive). Third visit signals intent.

**Browser push notifications (Web Push API):**
After the user has claimed at least 3 daily bonuses (proves they're using the tracker), show a one-time opt-in prompt:

```
┌──────────────────────────────────────────┐
│ 🔔 Never miss a reset                   │
│ Get notified when your casinos are      │
│ ready to claim.                          │
│ [Enable notifications] [No thanks]      │
└──────────────────────────────────────────┘
```

- If accepted: register a push subscription via the Push API + store the subscription in a new `push_subscriptions` table:

```sql
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  subscription_json TEXT NOT NULL,     -- the PushSubscription object from the browser
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
```

- **Push notification types at MVP:**
  - **Daily reset reminder:** Fires once daily at the time of the user's earliest casino reset. Message: "Your casinos are ready to claim." Action URL: `/tracker`. Only fires if the user hasn't visited `/tracker` in the last 2 hours (don't notify someone who's already looking at it).
  - **High-value intel alert:** When a `discord_intel_items` row is published with `confidence = 'high'` and `item_type IN ('flash_sale', 'free_sc', 'promo_code')`, push to all users who track that casino. Message: "[Casino]: [title]". These are the time-sensitive items where push notifications earn their keep — a flash sale notification that arrives in real time turns SweepsIntel from a tool into a service.
  - **State pullout alert:** When a `state_pullout_alerts` row is created, push to all users subscribed to that state. Message: "⚠️ [Casino/Provider] has stopped accepting players in [State]."

- **Push sending:** Use the Web Push protocol (VAPID keys stored in env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). The `web-push` npm package handles this. Send from a Vercel serverless function triggered by the event (claim check, intel publish, pullout alert).

- **Frequency cap:** No more than 3 push notifications per user per day. If the cap is hit, queue the notification for the next day's first available slot. Users who get spammed will disable notifications permanently — cap prevents this.

- **Unsubscribe:** Settings page has a "Push notifications" toggle. Disabling sets `is_active = false` on all subscriptions.

**Bookmark prompt (Safari fallback):**
Safari on iOS does not support Web Push at the PWA level in the same way as Chrome. For Safari users who haven't installed the PWA, show a periodic reminder on the tracker page (once every 14 days):

```
┌──────────────────────────────────────────┐
│ ⭐ Bookmark this page for quick access  │
│ Press ⌘+D (or tap Share → Add Bookmark) │
│ [Got it]                                 │
└──────────────────────────────────────────┘
```

Dismiss suppresses for 14 days via cookie.

**Return-path from affiliate redirect:**
When a user clicks "Join" on a Section 2 casino and gets redirected to the casino's signup page, they leave SweepsIntel. The return path:
- Open the affiliate URL in a **new tab** (`target="_blank"`). SweepsIntel stays open in the original tab.
- After the redirect fires, show a toast in the SweepsIntel tab: "✓ [Casino] added to your tracker. Come back here after you sign up to start tracking."
- This is the single most important UX detail for preventing user loss on affiliate clicks.

---

## File structure



```
src/
  components/
    casino/
      CasinoCard.tsx
      CasinoDetailPanel.tsx
      VolatilityTable.tsx         -- community volatility reports display (post-MVP)
      GameAvailabilityTable.tsx  -- cross-wash game availability per casino with confidence badges
      BanReportFeed.tsx
      RedemptionTimeStats.tsx     -- median, p80, trend signal
      LiveGamesIndicator.tsx
    tracker/
      DailyTracker.tsx            -- React island, client:load
      CasinoRow.tsx
      ResetCountdown.tsx
      ClaimModal.tsx
      PersonalizedIntelFeed.tsx   -- "My Alerts" section: intel items for user's tracked casinos only
    redemptions/
      RedemptionList.tsx
      RedemptionForm.tsx
      InTransitBanner.tsx
    ledger/
      LedgerTable.tsx
      LedgerSummary.tsx
      ManualEntryForm.tsx
      LedgerModeToggle.tsx
    notifications/
      NotificationPanel.tsx
      NotificationBadge.tsx       -- bell icon with unread count
    states/
      StateMap.tsx
      StateCard.tsx
      PulloutAlertBanner.tsx
    auth/
      OTPForm.tsx
      SessionGate.tsx
    forms/
      BanReportForm.tsx
      StateReportForm.tsx          -- includes optional provider_id for provider-level exits
      ResetTimeSuggestionForm.tsx
      VolatilityReportForm.tsx
      StateSubscriptionSelector.tsx -- shown on first OTP verify
    admin/
      AdminCasinoForm.tsx
      FlagQueue.tsx
      ReportQueue.tsx
      DiscordIntelQueue.tsx
      UserSuggestedCasinoQueue.tsx  -- review queue for source='user_suggested' casinos
      ProviderStateManager.tsx      -- provider cascade action UI
      NotificationComposer.tsx
      QuickEditRow.tsx
    retention/
      AddToHomeScreen.tsx         -- PWA install prompt (shows on 3rd tracker visit)
      PushOptIn.tsx               -- push notification opt-in (shows after 3 claims)
      BookmarkPrompt.tsx          -- Safari/fallback bookmark reminder
    layout/
      Header.tsx                  -- includes NotificationBadge when authed
      Footer.tsx
      Nav.tsx
  lib/
    db.ts                         -- Neon connection + query helpers
    auth.ts                       -- OTP generation, session validation, middleware, admin check
    affiliate.ts                  -- link resolution + click logging
    email.ts                      -- Resend abstraction
    reset.ts                      -- reset time calculation (Luxon)
    balance.ts                    -- SC balance calculation
    redemption-stats.ts           -- median/p80/trend aggregation
    notifications.ts              -- create + fan out user_notifications
    admin.ts                      -- admin utilities (flag creation, report approval flow)
    trust.ts                      -- trust score logic (simple at MVP)
    volatility.ts                 -- consensus volatility aggregation
    discord-intel.ts              -- discord_intel_items CRUD, expiry filtering, reaction sync, auto-publish check
    push.ts                       -- Web Push sending (VAPID, subscription management, frequency cap)
  pages/
    index.astro
    getting-started.astro
    notifications.astro
    casinos/
      index.astro
      [slug].astro
    states/
      index.astro
      [code].astro
    tracker.astro
    redemptions.astro
    ledger.astro
    admin/
      index.astro
      casinos/
        index.astro
        new.astro
        [id].astro
      flags.astro
      reports.astro
      states.astro
      notifications.astro
      discord.astro             -- discord intel queue
      providers.astro           -- provider state availability management + cascade
      settings.astro            -- admin settings (auto-publish toggle, delay config)
    api/
      auth/
        request-otp.ts
        verify-otp.ts
        logout.ts
      tracker/
        claim.ts
        status.ts
        add-casino.ts            -- search/add casino to tracker (creates user_casino_settings row; creates user_suggested casino row if no match; optionally fires affiliate click + logs to clicks table when fire_affiliate=true — see Section 2 "Join" CTA spec)
        bulk-import.ts           -- POST .txt/.csv file upload → parse casino names → run add-casino logic per line → return summary. Edge cases: max file size 1MB, UTF-8 encoding, handle both CRLF and LF line endings, strip leading/trailing whitespace per line, skip blank lines, case-insensitive ILIKE match against casinos.name, skip duplicates silently (already in tracker), no affiliate clicks fired during bulk import. Return JSON summary: { added: number, matched_existing: number, created_suggested: number, skipped_duplicate: number }
      redemptions/
        submit.ts
        update-status.ts
      ledger/
        entry.ts
      reports/
        ban-submit.ts
        state-submit.ts
        reset-suggestion.ts
        volatility-submit.ts
      affiliate/
        click.ts
      waitlist/
        capture.ts               -- POST email + source → insert into email_waitlist (dedup on email, no OTP, no user_settings row)
      notifications/
        mark-read.ts
      push/
        subscribe.ts              -- POST push subscription JSON from browser
        unsubscribe.ts            -- POST to deactivate subscription
      admin/
        casinos.ts               -- create/update casino (includes promote user_suggested → admin, exclude)
        report-action.ts         -- publish/reject report
        flag-action.ts           -- act/dismiss admin flag (actioning a pullout flag invokes the state pullout alert flow — see Feature #3)
        state-update.ts          -- update casino_state_availability (single casino)
        provider-state-update.ts -- update provider_state_availability + cascade to affected casinos (see Admin panel provider cascade spec)
        notify.ts                -- send system notification
        discord-intel-action.ts  -- publish/discard discord_intel_items
        trust-score.ts           -- admin adjustment of user trust scores
      cron/
        auto-publish.ts          -- Vercel cron (every 15min): auto-publishes high-confidence intel items past delay threshold
        push-resets.ts           -- Vercel cron (every 15min): sends daily reset push notifications to eligible users
      discord/
        ingest.ts                -- API-key gated ingest endpoint for monitoring pipeline
        game-availability.ts     -- API-key gated endpoint for game availability signals (batch UPSERT into casino_game_availability, auto-flag on 2+ negative signals)
        react.ts                 -- POST confirm/dispute reaction on published intel item (auth required, one per user per item, updates discord_intel_reactions + denormalized counts on discord_intel_items)
  content/
    casinos/                     -- MDX files (11 drafted, 52 remaining)
    config.ts                    -- Zod schema (extend with new fields)
```

---

## Average redemption times — platform-level aggregation

This is a major differentiator. No other platform has user-logged redemption data.

**Where it shows:** On each casino profile — "Median: 2.3 days | 80th pct: 4.1 days | Based on 84 community redemptions"

**Trend signal:** If recent 30d median is >20% slower than prior 30d: "⚠️ Processing times appear to be increasing recently." When trend signal trips, also create an `admin_flags` row with `flag_type = 'redemption_slowdown'`.

**Implementation in `src/lib/redemption-stats.ts`:**
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
Then compute median and p80 in application code. Cache 1 hour per casino.

Reference: `Casino/web/lib/v2/redemptions.ts` → `buildRedemptionCasinoViews`, `median()`, `p80()`, `computeStuckBaselineDays()`.

Fewer than 5 completed redemptions: show "Insufficient data."

---

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

7. **Affiliate link redirect:** All affiliate clicks through `/api/affiliate/click` — never embed raw URL in HTML. Confirm this is the right tradeoff (analytics + scraping protection vs. slight latency).

# SweepsIntel — Database Schema
## Full data model

Run this schema against Neon. This document is authoritative.

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

### `push_subscriptions`
Browser push notification subscriptions for Web Push API. Stores PushSubscription objects per user.

```sql
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  subscription_json TEXT NOT NULL,     -- the PushSubscription object from the browser
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_push_subs_user_active ON push_subscriptions(user_id) WHERE is_active = true;
```

**Implementation:** A cron-like check runs on each page load of `/admin` or can be triggered by a Vercel cron job (recommended: every 15 minutes). Query: `SELECT * FROM discord_intel_items WHERE is_published = false AND confidence = 'high' AND created_at < NOW() - INTERVAL '1 minute' * [delay] AND (expires_at IS NULL OR expires_at > NOW() + INTERVAL '3 hours') AND casino_id IS NOT NULL AND item_type NOT IN ('platform_warning', 'state_intel')`. For each qualifying row: set `is_published = true`, `published_at = NOW()`, `auto_published = true`.

**Why off by default:** Dylan needs to trust the pipeline first. He reviews everything manually until confidence scoring proves reliable. Then he flips the toggle and the 10-hour gap disappears. This is the escalation path from "I am the gate" to "the system handles routine approvals while I sleep."

**What never auto-publishes regardless of setting:** Items below `high` confidence. Items without a matched casino. Platform warnings and state intel (these require operational action, not just publishing).

**Personal URLs are never stored in `content`:** Giveaway links, personal referral URLs, and user-specific promo links must be stripped before ingestion. Platform-wide promotional URLs (casino.com/promo/spring-sale) are acceptable. When in doubt, strip the URL and describe the offer in text.

---

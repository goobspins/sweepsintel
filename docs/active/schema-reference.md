# SweepsIntel -- Canonical Schema Reference

> **Generated:** 2026-03-17
> **Database:** Neon Postgres (serverless)
> **Application stack:** Astro + React + TypeScript
> **Source of truth:** `src/db/migrations/schema.sql` + all migration files in `src/db/migrations/`

---

## Table of Contents

1. [Enums](#enums)
2. [Tables](#tables)
   - [casinos](#casinos)
   - [game_providers](#game_providers)
   - [casino_live_game_providers](#casino_live_game_providers)
   - [state_legal_status](#state_legal_status)
   - [provider_state_availability](#provider_state_availability)
   - [casino_game_availability](#casino_game_availability)
   - [game_volatility_reports](#game_volatility_reports)
   - [user_settings](#user_settings)
   - [user_casino_settings](#user_casino_settings)
   - [casino_state_availability](#casino_state_availability)
   - [state_availability_reports](#state_availability_reports)
   - [state_pullout_alerts](#state_pullout_alerts)
   - [user_state_subscriptions](#user_state_subscriptions)
   - [reset_time_suggestions](#reset_time_suggestions)
   - [daily_bonus_claims](#daily_bonus_claims)
   - [redemptions](#redemptions)
   - [ledger_entries](#ledger_entries)
   - [daily_aggregates](#daily_aggregates)
   - [user_notifications](#user_notifications)
   - [user_notification_preferences](#user_notification_preferences)
   - [admin_flags](#admin_flags)
   - [ban_reports](#ban_reports)
   - [ban_uptick_alerts](#ban_uptick_alerts)
   - [auth_sessions](#auth_sessions)
   - [clicks](#clicks)
   - [email_waitlist](#email_waitlist)
   - [discord_intel_items](#discord_intel_items)
   - [discord_intel_reactions](#discord_intel_reactions)
   - [signal_votes](#signal_votes)
   - [signal_confirmations](#signal_confirmations)
   - [signal_updates](#signal_updates)
   - [casino_health](#casino_health)
   - [events](#events)
   - [telemetry_events](#telemetry_events)
   - [moderation_actions](#moderation_actions)
   - [trust_snapshots](#trust_snapshots)
   - [admin_settings](#admin_settings)
   - [push_subscriptions](#push_subscriptions)
   - [push_notification_log](#push_notification_log)
3. [Table Dependency Graph](#table-dependency-graph)
4. [Migration History](#migration-history)
5. [Known Schema Debt](#known-schema-debt)
6. [Recommended Indexes](#recommended-indexes)

---

## Enums

### `state_avail_status`
Used by `casino_state_availability` and `provider_state_availability`.

| Value | Meaning |
|---|---|
| `available` | Casino/provider operates normally in this state |
| `restricted` | State prohibits or heavily restricts sweepstakes |
| `legal_but_pulled_out` | Legal, but the casino/provider has voluntarily exited |
| `operates_despite_restrictions` | Operates in a state with legal grey area |

### `redemption_status`
Lifecycle of a redemption request.

| Value | Meaning |
|---|---|
| `draft` | Created but not yet submitted |
| `pending` | Submitted, awaiting processing |
| `received` | Funds confirmed received by user |
| `cancelled` | Cancelled by user |
| `rejected` | Rejected by casino |

### `redemption_method`

| Value | Meaning |
|---|---|
| `ach` | Bank transfer |
| `crypto` | Cryptocurrency payout |
| `gift_card` | Gift card |
| `other` | Other method |

### `ledger_entry_type`
All transaction types tracked in the ledger.

| Value | Meaning |
|---|---|
| `daily` | Daily bonus claim |
| `offer` | Special promotional offer |
| `winnings` | Gameplay winnings |
| `wager` | Funds wagered |
| `adjustment` | Manual admin or user adjustment |
| `redeem_confirmed` | Redemption confirmed (system-generated) |
| `purchase` | SC purchased with real money |
| `free_sc` | Free SC received (no purchase) |
| `purchase_credit` | Credit applied from a purchase |

### `notification_type`

| Value | Meaning |
|---|---|
| `state_pullout` | A casino/provider has exited a state |
| `ban_uptick` | Elevated ban reports for a casino |
| `system` | Generic platform notification |

### `health_status`
Used by `casino_health.effective_status` for sticky health state tracking introduced in the v2 schema foundation.

| Value | Meaning |
|---|---|
| `healthy` | No active health concern |
| `watch` | Early warning / caution state |
| `at_risk` | Elevated concern requiring attention |
| `critical` | Highest-risk state |

---

## Tables

---

### `casinos`

**Purpose:** Master record for every sweepstakes casino tracked on the platform, holding identity, configuration, affiliate, risk, and operational metadata.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | Surrogate identifier |
| `slug` | VARCHAR(50) | NO | -- | UNIQUE NOT NULL | URL-safe identifier (e.g. `chumba-casino`) used in routes and affiliate links |
| `name` | VARCHAR(100) | NO | -- | NOT NULL | Display name |
| `normalized_name` | VARCHAR(200) | YES | NULL | -- | Lowercase, stripped of common noise words (`casino`, `sweeps`, `.com`) for fuzzy matching. Added via migration. |
| `tier` | VARCHAR(1) | YES | `'B'` | -- | **Vestigial.** Original single-char tier column. Superseded by `tier_label`; no TypeScript code reads this column directly. |
| `tier_label` | VARCHAR(2) | YES | NULL | -- | Active tier label displayed in UI (values: `S`, `A`, `B`, `C`). Added via migration. All TypeScript code aliases this as `tier`. |
| `claim_url` | TEXT | YES | NULL | -- | URL for the daily claim page at this casino |
| `website_url` | TEXT | YES | NULL | -- | Top-level website URL. Added via migration. |
| `reset_mode` | VARCHAR(20) | YES | `'rolling'` | CHECK (`rolling` or `fixed`) | Controls how the daily reset period is calculated. `rolling` = 24h from last claim; `fixed` = resets at a specific time daily. |
| `reset_time_local` | VARCHAR(5) | YES | NULL | -- | For `fixed` reset mode: local time of reset in `HH:MM` format |
| `reset_timezone` | VARCHAR(50) | YES | NULL | -- | IANA timezone name for `reset_time_local` (e.g. `America/New_York`) |
| `reset_interval_hours` | INT | NO | `24` | -- | Hours between fixed resets (usually 24; some casinos use 48h) |
| `has_streaks` | BOOLEAN | YES | `FALSE` | -- | Whether this casino has a streak/consecutive-day bonus mechanic |
| `sc_to_usd_ratio` | DECIMAL(6,4) | YES | `1.0` | -- | Conversion rate from sweeps coins to USD for display and P&L calculations |
| `parent_company` | VARCHAR(100) | YES | NULL | -- | Corporate parent, used for family-ban propagation logic |
| `promoban_risk` | VARCHAR(20) | YES | `'unknown'` | -- | Risk level for promo/bonus abuse bans (values observed: `low`, `medium`, `high`, `unknown`) -- no CHECK constraint |
| `hardban_risk` | VARCHAR(20) | YES | `'unknown'` | -- | Risk level for permanent account bans -- no CHECK constraint |
| `family_ban_propagation` | BOOLEAN | YES | `FALSE` | -- | Whether a ban at one property propagates to sister casinos |
| `ban_confiscates_funds` | BOOLEAN | YES | `FALSE` | -- | Whether a ban results in forfeiture of remaining SC balance |
| `daily_bonus_desc` | VARCHAR(100) | YES | NULL | -- | Human-readable description of the daily bonus (e.g. `"Up to 300 SC"`) |
| `daily_bonus_sc_avg` | INT | YES | NULL | -- | Admin-entered estimate of average daily SC value; used as fallback when no claims data exists |
| `has_live_games` | BOOLEAN | YES | `FALSE` | -- | Whether this casino offers live dealer games. Redundant with `casino_live_game_providers`; not queried in TS. |
| `redemption_speed_desc` | VARCHAR(100) | YES | NULL | -- | Human-readable description of redemption speed (e.g. `"1-3 business days"`) |
| `redemption_fee_desc` | VARCHAR(100) | YES | NULL | -- | Description of any redemption fees |
| `min_redemption_usd` | DECIMAL(10,2) | YES | NULL | -- | Minimum redemption amount in USD |
| `has_affiliate_link` | BOOLEAN | YES | `FALSE` | -- | Whether a tracked affiliate link exists for this casino |
| `affiliate_link_url` | TEXT | YES | NULL | -- | The affiliate URL used for click-tracking and deep-linking |
| `affiliate_type` | VARCHAR(20) | YES | NULL | -- | Type of affiliate relationship (e.g. `cpa`, `revshare`) |
| `affiliate_enrollment_verified` | BOOLEAN | YES | `FALSE` | -- | Whether affiliate enrollment has been manually confirmed |
| `source` | VARCHAR(20) | YES | `'admin'` | -- | Origin of the record: `admin` (staff-curated) or `user_suggested` (created by a user via the tracker add flow) |
| `is_excluded` | BOOLEAN | YES | `FALSE` | -- | Soft-exclude from suggestions and public listings without deleting |
| `last_updated_at` | TIMESTAMP | YES | `NOW()` | -- | Last time any casino field was updated |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | Record creation timestamp |

#### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `casinos_pkey` | `id` | Primary key | |
| `casinos_slug_key` | `slug` | Unique | |
| `idx_casinos_tier` | `tier` | B-tree | Filters by tier in suggestion queries. Points at vestigial `tier` column -- should target `tier_label`. |
| `idx_casinos_normalized_name` | `normalized_name` | B-tree | Supports fuzzy-match lookups in `addCasinoToTracker` |
| `idx_casinos_user_suggested` | `id` WHERE `source = 'user_suggested'` | Partial | Used in admin review of user-suggested casinos |

**Missing indexes:** `(is_excluded, source)` -- `getTrackerSuggestions` filters on both; a composite index would help as the casino table grows.

#### Relationships

| Relation | Type | Details |
|---|---|---|
| `casino_live_game_providers.casino_id` | FK -> `casinos.id` ON DELETE CASCADE | Providers linked to this casino |
| `casino_game_availability.casino_id` | FK -> `casinos.id` ON DELETE CASCADE | Games at this casino |
| `game_volatility_reports.casino_id` | FK -> `casinos.id` ON DELETE CASCADE | Volatility reports for this casino |
| `user_casino_settings.casino_id` | FK -> `casinos.id` ON DELETE CASCADE | User tracker entries |
| `casino_state_availability.casino_id` | FK -> `casinos.id` ON DELETE CASCADE | State-level availability |
| `casino_health.casino_id` | FK -> `casinos.id` (PRIMARY KEY) | Computed health record |
| `state_pullout_alerts.casino_id` | FK -> `casinos.id` NO ACTION | Alerts for this casino |
| `reset_time_suggestions.casino_id` | FK -> `casinos.id` NO ACTION | User-submitted reset suggestions |
| `daily_bonus_claims.casino_id` | FK -> `casinos.id` NO ACTION | Claims at this casino |
| `redemptions.casino_id` | FK -> `casinos.id` NO ACTION | Redemptions at this casino |
| `ledger_entries.casino_id` | FK -> `casinos.id` NO ACTION | Ledger entries at this casino |
| `user_notifications.casino_id` | FK -> `casinos.id` NO ACTION | Notifications referencing this casino |
| `admin_flags.casino_id` | FK -> `casinos.id` NO ACTION | Admin flags referencing this casino |
| `ban_reports.casino_id` | FK -> `casinos.id` NO ACTION | Ban reports |
| `ban_uptick_alerts.casino_id` | FK -> `casinos.id` NO ACTION | Ban uptick alerts |
| `clicks.casino_id` | FK -> `casinos.id` NO ACTION | Affiliate click log |
| `discord_intel_items.casino_id` | FK -> `casinos.id` NO ACTION | Intel items |
| `state_availability_reports.casino_id` | FK -> `casinos.id` NO ACTION | State availability reports |

#### Query Patterns

- **Tracker load** (`tracker.ts:getTrackerStatus`): JOINs `user_casino_settings`, `casino_health` (LEFT), `daily_bonus_claims` (LATERAL), filtering by `ucs.removed_at IS NULL`, ordered by `sort_order`.
- **Suggestions** (`tracker.ts:getTrackerSuggestions`): Filters `source = 'admin' AND is_excluded = false`, LEFT JOINs aggregated `daily_bonus_claims` for average SC, orders by `sort_sc DESC`.
- **Name resolution** (`tracker.ts:resolveCasinoByName`): Looks up by `LOWER(name) = LOWER($1) OR normalized_name = $2`, prefers `source = 'admin'`.
- **Intel feed** (`intel.ts:getIntelFeed`): JOINs `discord_intel_items` to `casinos` for `name`, `slug`, `tier_label`.
- **Admin CRUD** (`api/admin/casinos.ts`): Full INSERT/UPDATE of all fields; syncs provider links.

#### Active vs. Vestigial Columns

| Column | Status | Notes |
|---|---|---|
| `tier` | **Vestigial** | Superseded by `tier_label`. `idx_casinos_tier` indexes this column. No TS code reads `tier` directly. |
| `has_live_games` | **Likely vestigial** | Not queried in any TS found; the `casino_live_game_providers` table is the authoritative source. |
| `streak_mode` | **Removed/never existed** | Referenced in a migration UPDATE but never defined. See schema debt. |

#### Data Volume Estimate

**Slow growth.** Admin-curated list of sweepstakes casinos. Likely under 200 records for years. User-suggested casinos could add noise.

---

### `game_providers`

**Purpose:** Tracks third-party game software providers (e.g. Pragmatic Play, NetEnt) that power casino games, used for cross-wash analysis and state-exit cascade logic.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `slug` | VARCHAR(50) | NO | -- | UNIQUE NOT NULL | URL-safe identifier used in Discord ingest and API lookups |
| `name` | VARCHAR(100) | NO | -- | NOT NULL | Display name |
| `is_live_game_provider` | BOOLEAN | YES | `FALSE` | -- | Whether this provider offers live dealer games specifically |
| `notes` | TEXT | YES | NULL | -- | Internal admin notes |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns | Notes |
|---|---|---|
| `game_providers_pkey` | `id` | |
| `game_providers_slug_key` | `slug` | Unique; used by `resolveProviderBySlug` |

#### Relationships

| Relation | Type |
|---|---|
| `casino_live_game_providers.provider_id` | FK -> `game_providers.id` ON DELETE CASCADE |
| `provider_state_availability.provider_id` | FK -> `game_providers.id` ON DELETE CASCADE |
| `casino_game_availability.provider_id` | FK -> `game_providers.id` NO ACTION |
| `game_volatility_reports.provider_id` | FK -> `game_providers.id` NO ACTION |
| `state_pullout_alerts.provider_id` | FK -> `game_providers.id` NO ACTION |
| `state_availability_reports.provider_id` | FK -> `game_providers.id` NO ACTION |

#### Query Patterns

- **Slug lookup** (`discord-intel.ts:resolveProviderBySlug`): `WHERE slug = $1 LIMIT 1`
- **Cascade lookup** (`admin.ts:runProviderCascadeFlow`): `SELECT DISTINCT c.id, c.name FROM casino_live_game_providers clgp JOIN casinos c ON c.id = clgp.casino_id WHERE clgp.provider_id = $1`

#### Data Volume Estimate

**Static.** A few dozen providers; changes only when a new provider is integrated.

---

### `casino_live_game_providers`

**Purpose:** Junction table linking casinos to the live game providers they use, supporting cross-wash risk analysis and state-exit cascades.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `casino_id` | INT | NO | -- | FK -> `casinos.id` CASCADE | |
| `provider_id` | INT | NO | -- | FK -> `game_providers.id` CASCADE | |
| -- | -- | -- | -- | PRIMARY KEY `(casino_id, provider_id)` | |

#### Indexes

| Index | Columns |
|---|---|
| `casino_live_game_providers_pkey` | `(casino_id, provider_id)` |

**Missing index:** `(provider_id)` -- the cascade query in `admin.ts` filters by `provider_id` only; without this, the join scans by PK left-to-right. Postgres may be able to use the PK partially, but an explicit index on `provider_id` would be cleaner.

#### Data Volume Estimate

**Slow growth.** ~50-300 rows (one per casino-provider pairing).

---

### `state_legal_status`

**Purpose:** Reference table of all 50 US states plus DC, recording whether sweepstakes casino play is treated as legal in each jurisdiction.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `state_code` | CHAR(2) | NO | -- | PRIMARY KEY | Two-letter US state abbreviation (e.g. `NY`, `TX`) |
| `state_name` | VARCHAR(50) | NO | -- | NOT NULL | Full state name |
| `sweepstakes_legal` | BOOLEAN | NO | -- | NOT NULL | `TRUE` if sweepstakes play is treated as legal/available |
| `legal_notes` | TEXT | YES | NULL | -- | Human-readable notes about restrictions or special rules |
| `last_verified` | DATE | YES | NULL | -- | Date the legal status was last confirmed by research |
| `source_url` | TEXT | YES | NULL | -- | Citation URL for legal status (currently NULL for all seeded rows) |

#### Indexes

| Index | Columns |
|---|---|
| `state_legal_status_pkey` | `state_code` |

#### Relationships

Referenced as FK target by: `provider_state_availability`, `casino_state_availability`, `user_state_subscriptions`.

Implicit references (no FK constraint): `admin_flags.state_code`, `user_notifications.state_code`, `state_pullout_alerts.state_code`.

#### Query Patterns

Primarily used as a lookup/join target. The `settings.ts` API returns all state codes to populate state selectors. State code is the key join for notification fan-outs in `notifications.ts`.

#### Data Volume Estimate

**Static.** 51 rows (50 states + DC). Seeded once via `migrations/seed-states.sql`. Changes only if US territories are added.

---

### `provider_state_availability`

**Purpose:** Records whether a specific game provider is available, restricted, or has pulled out of each US state.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `provider_id` | INT | YES | NULL | FK -> `game_providers.id` CASCADE | |
| `state_code` | CHAR(2) | YES | NULL | FK -> `state_legal_status.state_code` | |
| `status` | state_avail_status | NO | `'available'` | NOT NULL | Availability status |
| `notes` | TEXT | YES | NULL | -- | Context for the status |
| `last_updated_at` | TIMESTAMP | YES | `NOW()` | -- | |
| -- | -- | -- | -- | UNIQUE `(provider_id, state_code)` | |

#### Indexes

| Index | Columns |
|---|---|
| `provider_state_availability_pkey` | `id` |
| `provider_state_availability_provider_id_state_code_key` | `(provider_id, state_code)` |

#### Query Patterns

- **Admin cascade** (`admin.ts:runProviderCascadeFlow`): Upserts on `(provider_id, state_code)` conflict.

#### Data Volume Estimate

**Slow growth.** Tens to low hundreds of rows; updated only when providers enter/exit states.

---

### `casino_game_availability`

**Purpose:** Tracks which specific games are available at each casino, with community-sourced signal counts for confidence scoring.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` CASCADE | |
| `provider_id` | INT | YES | NULL | FK -> `game_providers.id` NO ACTION | |
| `game_name` | VARCHAR(100) | NO | -- | NOT NULL | Name of the game (e.g. `"Sweet Bonanza"`) |
| `game_type` | VARCHAR(50) | YES | NULL | -- | Type: `slot`, `table`, `live`, etc. |
| `is_cross_wash_relevant` | BOOLEAN | YES | `FALSE` | -- | Whether this game is relevant to cross-wash bonus abuse detection |
| `confidence` | VARCHAR(20) | YES | `'unverified'` | -- | Signal confidence: `unverified`, `medium`, `high` |
| `positive_signal_count` | INT | YES | `0` | -- | Number of community-positive availability signals |
| `negative_signal_count` | INT | YES | `0` | -- | Number of community-negative availability signals |
| `last_confirmed_at` | TIMESTAMP | YES | NULL | -- | Last time a positive signal was received |
| `last_negative_at` | TIMESTAMP | YES | NULL | -- | Last time a negative signal was received |
| `status` | VARCHAR(20) | YES | `'available'` | -- | Current availability: `available`, `unavailable`, `unverified` |
| `notes` | TEXT | YES | NULL | -- | Internal notes |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |
| `updated_at` | TIMESTAMP | YES | `NOW()` | -- | |
| -- | -- | -- | -- | UNIQUE `(casino_id, game_name)` | |

#### Indexes

| Index | Columns | Condition |
|---|---|---|
| `casino_game_availability_pkey` | `id` | |
| `casino_game_availability_casino_id_game_name_key` | `(casino_id, game_name)` | Unique |
| `idx_game_avail_casino` | `(casino_id, status, is_cross_wash_relevant)` | |
| `idx_game_avail_negative` | `negative_signal_count` | WHERE `negative_signal_count >= 2` |

#### Query Patterns

- **Discord ingest** (`api/discord/game-availability.ts`): Upserts on `(casino_id, game_name)` conflict; increments `positive_signal_count` or `negative_signal_count`.

#### Data Volume Estimate

**Slow growth.** Hundreds to a few thousand rows. Append-only for signals; updated in place.

---

### `game_volatility_reports`

**Purpose:** Stores community-reported volatility and RTP data for specific casino games, pending admin review and publishing.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` CASCADE | |
| `game_name` | VARCHAR(100) | NO | -- | NOT NULL | |
| `provider_id` | INT | YES | NULL | FK -> `game_providers.id` NO ACTION | |
| `reported_volatility` | VARCHAR(20) | NO | -- | NOT NULL | e.g. `low`, `medium`, `high` |
| `reported_rtp_pct` | DECIMAL(5,2) | YES | NULL | -- | Reported return-to-player percentage |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | Reporter's user ID (no FK constraint) |
| `trust_score_at_report` | DECIMAL(3,2) | YES | `1.0` | -- | Reporter's trust score snapshot at submission time |
| `notes` | TEXT | YES | NULL | -- | |
| `is_flagged` | BOOLEAN | YES | `FALSE` | -- | Admin-flagged for review |
| `is_published` | BOOLEAN | YES | `FALSE` | -- | Whether report is publicly visible |
| `admin_notes` | TEXT | YES | NULL | -- | Internal admin notes |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns |
|---|---|
| `game_volatility_reports_pkey` | `id` |
| `idx_volatility_casino_game` | `(casino_id, game_name, created_at DESC)` |

#### Active vs. Vestigial

**Likely vestigial or pre-launch.** No TypeScript code in `src/lib/` or `src/pages/api/` references this table in the reviewed codebase. The table exists and has an index, but there is no visible API endpoint for submitting or reading volatility reports.

#### Data Volume Estimate

**Slow growth or dormant.** Would be append-only if activated.

---

### `user_settings`

**Purpose:** One row per registered user, storing profile preferences, system roles, trust metrics, and contributor status.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `user_id` | VARCHAR(255) | NO | -- | PRIMARY KEY | The user's email address (used as identifier throughout the system) |
| `timezone` | VARCHAR(50) | YES | `'America/New_York'` | -- | IANA timezone for reset-period calculations and display formatting |
| `home_state` | CHAR(2) | YES | NULL | -- | User's home state; used for state-pullout notification targeting |
| `ledger_mode` | VARCHAR(20) | YES | `'simple'` | -- | UI mode: `simple` (just track) or `advanced` (full ledger) |
| `is_admin` | BOOLEAN | YES | `FALSE` | -- | Platform admin flag; gates admin API routes |
| `trust_score` | DECIMAL(3,2) | YES | `0.50` | -- | Computed trust score 0.00-1.00 (updated by cron). Default changed from `1.0` to `0.50` in intelligence-layer migration. |
| `trust_score_updated_at` | TIMESTAMP | YES | NULL | -- | Last time the trust score was recomputed |
| `contributor_tier` | VARCHAR(30) | YES | `'newcomer'` | CHECK (`newcomer`, `scout`, `insider`, `operator`) | Signal-submission contributor tier |
| `layout_swap` | BOOLEAN | YES | `FALSE` | -- | UI layout preference toggle. Added in intelligence-layer migration. |
| `anonymous_preference` | BOOLEAN | YES | `TRUE` | -- | Sticky default for anonymous user-signal submission. Added in `v2-schema-foundation` migration. |
| `trust_last_activity_at` | TIMESTAMPTZ | YES | NULL | -- | Last trust-relevant activity timestamp, reserved for future inactivity decay logic. Added in `v2-schema-foundation` migration. |
| `daily_goal_usd` | DECIMAL(10,2) | YES | `5.00` | -- | User's daily earnings goal in USD. Added in dashboard-foundation migration. |
| `weekly_goal_usd` | DECIMAL(10,2) | YES | NULL | -- | User's weekly earnings goal. Added in dashboard-foundation migration. |
| `momentum_period` | TEXT | YES | `'daily'` | CHECK (`daily`, `weekly`) | Dashboard momentum display period. Added in dashboard-foundation migration. |
| `momentum_style` | JSONB | YES | NULL | -- | JSONB blob for momentum widget configuration. Added in dashboard-foundation migration. |
| `kpi_cards` | JSONB | YES | NULL | -- | JSONB array defining which KPI cards to display and in what order. Added in dashboard-foundation migration. |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | Account creation timestamp |
| `updated_at` | TIMESTAMP | YES | `NOW()` | -- | Last settings update |

#### Indexes

| Index | Columns |
|---|---|
| `user_settings_pkey` | `user_id` |

**Missing indexes:** No indexes on `user_id` beyond PK (redundant). The trust computation cron (`computeAllTrustScores`) does a full table scan with `SELECT user_id FROM user_settings` -- acceptable at small scale.

#### Relationships

- Referenced as FK target by: `signal_votes.user_id`, `user_notification_preferences.user_id`, `daily_aggregates.user_id`
- Implicit references (no FK): `auth_sessions.user_id`, `user_casino_settings.user_id`, `daily_bonus_claims.user_id`, `redemptions.user_id`, `ledger_entries.user_id`, `discord_intel_items.submitted_by`, `ban_reports.reporter_user_id`, `clicks.user_id`, `push_subscriptions.user_id`, `push_notification_log.user_id`

#### Query Patterns

- **Session validation** (`auth.ts:validateSession`): `SELECT ... FROM auth_sessions s LEFT JOIN user_settings us ON us.user_id = s.user_id WHERE s.session_token_hash = $1`
- **Trust score update** (`trust.ts:computeTrustScore`): `UPDATE user_settings SET trust_score = $2, trust_score_updated_at = NOW() WHERE user_id = $1`
- **Contributor tier update** (`trust.ts:evaluateContributorTier`): `UPDATE user_settings SET contributor_tier = $2 WHERE user_id = $1`
- **Settings GET/POST** (`api/settings.ts`): Full read and selective write of all columns.

#### Data Volume Estimate

**Slow growth.** One row per registered user. Append-only with in-place updates.

---

### `user_casino_settings`

**Purpose:** Records which casinos a user is actively tracking, with per-casino preferences and soft-delete for removal.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | User identifier (no FK; implicit reference to `user_settings.user_id`) |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` CASCADE | |
| `typical_daily_sc` | DECIMAL(8,2) | YES | NULL | -- | User's personal estimate of their average daily SC at this casino |
| `personal_notes` | TEXT | YES | NULL | -- | **Potentially vestigial.** Older notes field. The `notes` column was added later via migration. |
| `notes` | TEXT | YES | NULL | -- | Notes field added via `2026-03-16-user-casino-settings-notes.sql` migration. Used by the notes API endpoint. |
| `sort_order` | INT | YES | NULL | -- | User-defined sort position in the tracker list |
| `no_daily_reward` | BOOLEAN | NO | `FALSE` | NOT NULL | Flag indicating this casino has no daily reward (suppress "unclaimed" reminders) |
| `added_at` | TIMESTAMP | YES | `NOW()` | -- | When the casino was added to the tracker |
| `removed_at` | TIMESTAMP | YES | NULL | -- | Soft-delete timestamp; NULL means currently tracked |
| -- | -- | -- | -- | UNIQUE `(user_id, casino_id)` | |

#### Indexes

| Index | Columns | Condition | Notes |
|---|---|---|---|
| `user_casino_settings_pkey` | `id` | | |
| `user_casino_settings_user_id_casino_id_key` | `(user_id, casino_id)` | Unique | |
| `idx_ucs_user_active` | `user_id` | WHERE `removed_at IS NULL` | Defined in schema.sql |
| `idx_user_casino_settings_user_active` | `user_id` | WHERE `removed_at IS NULL` | **Duplicate** of above; defined in `2026-03-17-add-indexes.sql` with a different name. Two identical partial indexes exist. |

#### Query Patterns

- **Tracker load**: Filtered by `user_id = $1 AND removed_at IS NULL`, JOINed to `casinos` and `casino_health`.
- **Notification fan-out** (`notifications.ts`): `SELECT DISTINCT ucs.user_id FROM user_casino_settings ucs WHERE ucs.casino_id = $1 AND ucs.removed_at IS NULL`
- **Push broadcast** (`push.ts:sendPushToSegment`): JOINs `push_subscriptions` by `casino_id` with `removed_at IS NULL` filter.
- **Intel feed**: `SELECT casino_id FROM user_casino_settings WHERE user_id = $1 AND removed_at IS NULL` to build the casino filter list.
- **Tracker suggestions**: `c.id NOT IN (SELECT casino_id FROM user_casino_settings WHERE user_id = $1 AND removed_at IS NULL)`

#### Active vs. Vestigial Columns

- `personal_notes`: Uncertain. The tracker interface defines `personal_notes` and the query returns it, but the notes API endpoint likely targets `notes`. Both exist simultaneously -- probable duplication.

#### Data Volume Estimate

**Fast growth.** Each user x casino pairing = one row. With soft-deletes, rows are never removed. Could reach tens of thousands.

---

### `casino_state_availability`

**Purpose:** Records casino-level state availability status, supporting both admin-verified data and community reports.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` CASCADE | |
| `state_code` | CHAR(2) | YES | NULL | FK -> `state_legal_status.state_code` | |
| `status` | state_avail_status | NO | `'available'` | NOT NULL | |
| `compliance_note` | TEXT | YES | NULL | -- | Explanation of the status |
| `community_reported` | BOOLEAN | YES | `FALSE` | -- | Whether the status came from a community report |
| `reported_at` | TIMESTAMP | YES | NULL | -- | When a community report was filed |
| `verified` | BOOLEAN | YES | `FALSE` | -- | Whether an admin has verified this status |
| `last_updated_at` | TIMESTAMP | YES | `NOW()` | -- | |
| -- | -- | -- | -- | UNIQUE `(casino_id, state_code)` | |

#### Indexes

| Index | Columns |
|---|---|
| `casino_state_availability_pkey` | `id` |
| `casino_state_availability_casino_id_state_code_key` | `(casino_id, state_code)` |

#### Query Patterns

- **Admin pullout flow** (`admin.ts:runCasinoPulloutFlow`): Upserts on `(casino_id, state_code)` conflict, setting `verified = true`.
- **Provider cascade** (`admin.ts:runProviderCascadeFlow`): Upserts `legal_but_pulled_out` status for all casinos linked to the affected provider.

#### Data Volume Estimate

**Slow growth.** At most `num_casinos x 51` rows (~10,000 upper bound). Most casinos won't have explicit entries for all states.

---

### `state_availability_reports`

**Purpose:** Captures community-submitted reports about casino or provider state availability changes, pending admin review.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | Nullable; a report can be about a provider without a specific casino |
| `provider_id` | INT | YES | NULL | FK -> `game_providers.id` NO ACTION | Nullable; a report can be about a casino without a specific provider |
| `state_code` | CHAR(2) | YES | NULL | -- | No FK constraint (schema debt) |
| `reported_status` | state_avail_status | NO | -- | NOT NULL | The status the reporter observed |
| `report_text` | TEXT | NO | -- | NOT NULL | Reporter's description |
| `reporter_ip_hash` | VARCHAR(64) | YES | NULL | -- | SHA-256 hash of reporter's IP for deduplication |
| `reporter_user_id` | VARCHAR(255) | YES | NULL | -- | Reporter's user ID if logged in (no FK constraint) |
| `is_flagged` | BOOLEAN | YES | `FALSE` | -- | Flagged by admin for follow-up |
| `is_published` | BOOLEAN | YES | `FALSE` | -- | Whether this report has been acted upon/published |
| `admin_notes` | TEXT | YES | NULL | -- | |
| `submitted_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns | Condition |
|---|---|---|
| `state_availability_reports_pkey` | `id` | |
| `idx_state_reports_pending` | `id` | WHERE `is_published = false` |

#### Data Volume Estimate

**Slow growth / append-only log.** Reports are never updated (only flagged/published flags change).

---

### `state_pullout_alerts`

**Purpose:** Log of alerts generated when a casino or provider exits a state, used for notification broadcast tracking.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | |
| `provider_id` | INT | YES | NULL | FK -> `game_providers.id` NO ACTION | |
| `state_code` | CHAR(2) | YES | NULL | -- | No FK constraint (schema debt) |
| `alert_message` | TEXT | YES | NULL | -- | Human-readable alert content |
| `was_broadcast` | BOOLEAN | YES | `FALSE` | -- | Whether a push/in-app notification was sent |
| `broadcast_at` | TIMESTAMP | YES | NULL | -- | When broadcast was sent |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Relationships

Implicit: `state_code` references `state_legal_status.state_code` with no FK constraint.

#### Data Volume Estimate

**Slow growth / append-only log.**

---

### `user_state_subscriptions`

**Purpose:** Records which US states a user has subscribed to for pullout and availability alerts.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | No FK constraint (implicit reference to `user_settings.user_id`) |
| `state_code` | CHAR(2) | YES | NULL | FK -> `state_legal_status.state_code` | |
| -- | -- | -- | -- | UNIQUE `(user_id, state_code)` | |

#### Query Patterns

- **Notification fan-out** (`notifications.ts`): `SELECT uss.user_id FROM user_state_subscriptions uss WHERE uss.state_code = $1`
- **Push broadcast** (`push.ts`): JOINs `push_subscriptions` by `state_code`.
- **Settings API**: Reads/writes subscriptions when user updates their state preferences.

#### Data Volume Estimate

**Slow growth.** Most users subscribe to 1-3 states.

---

### `reset_time_suggestions`

**Purpose:** Collects community-submitted suggestions for correcting a casino's reset time configuration, pending admin review.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | |
| `suggested_reset_mode` | VARCHAR(20) | YES | NULL | -- | `rolling` or `fixed` |
| `suggested_reset_time` | VARCHAR(5) | YES | NULL | -- | `HH:MM` if fixed mode suggested |
| `suggested_timezone` | VARCHAR(50) | YES | NULL | -- | IANA timezone if fixed mode suggested |
| `evidence_text` | TEXT | YES | NULL | -- | Reporter's evidence/rationale |
| `reporter_ip_hash` | VARCHAR(64) | YES | NULL | -- | Deduplication hash |
| `reporter_user_id` | VARCHAR(255) | YES | NULL | -- | No FK constraint |
| `status` | VARCHAR(20) | YES | `'pending'` | -- | `pending`, `accepted`, `rejected` |
| `admin_notes` | TEXT | YES | NULL | -- | |
| `submitted_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns | Condition |
|---|---|---|
| `reset_time_suggestions_pkey` | `id` | |
| `idx_reset_suggestions_pending` | `id` | WHERE `status = 'pending'` |

#### Data Volume Estimate

**Slow growth / append-only log.**

---

### `daily_bonus_claims`

**Purpose:** Records every daily bonus claim a user makes at a casino, providing the primary data source for reset-period enforcement and streak tracking.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | No FK constraint |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | |
| `claim_type` | VARCHAR(20) | NO | `'daily'` | NOT NULL | Type of claim: `daily` (standard), others possible |
| `sc_amount` | DECIMAL(8,2) | YES | NULL | -- | SC amount received in this claim |
| `notes` | TEXT | YES | NULL | -- | Optional user note |
| `claimed_at` | TIMESTAMP | YES | `NOW()` | -- | Exact timestamp of claim |
| `claimed_date` | DATE | YES | `CURRENT_DATE` | -- | Calendar date (used in original UNIQUE constraint) |
| `reset_period_start` | TIMESTAMPTZ | YES | NULL | -- | Start of the reset period this claim belongs to (timezone-aware). Added in dashboard-foundation migration. Used for fixed-mode casinos. |
| -- | -- | -- | -- | UNIQUE `(user_id, casino_id, claimed_date, claim_type)` | Original calendar-day deduplication |

#### Indexes

| Index | Columns | Condition | Notes |
|---|---|---|---|
| `daily_bonus_claims_pkey` | `id` | | |
| `daily_bonus_claims_user_id_casino_id_claimed_date_claim_type_key` | `(user_id, casino_id, claimed_date, claim_type)` | Unique | Original deduplication |
| `idx_daily_claims_period` | `(user_id, casino_id, reset_period_start)` | WHERE `reset_period_start IS NOT NULL` | For fixed-reset casinos. Added in dashboard-foundation migration. |
| `idx_daily_bonus_claims_user_casino_date` | `(user_id, casino_id, claimed_at DESC)` | | Added in `2026-03-17-add-indexes.sql` |

#### Relationships

- `ledger_entries.source_claim_id` -> `daily_bonus_claims.id` (implicit traceability)

#### Query Patterns

- **Tracker status** (`tracker.ts`): LATERAL subquery `SELECT id, sc_amount, claimed_at FROM daily_bonus_claims WHERE user_id = $1 AND casino_id = $2 AND claim_type = 'daily' ORDER BY claimed_at DESC LIMIT 1` -- gets most recent claim per casino.
- **Streak tracking**: `SELECT casino_id, claimed_at FROM daily_bonus_claims WHERE user_id = $1 AND casino_id = ANY($2) AND claim_type = 'daily' ORDER BY casino_id ASC, claimed_at DESC`
- **Trust score** (`trust.ts`): `COUNT(DISTINCT (COALESCE(reset_period_start, claimed_at))::date)` for claim consistency scoring.
- **Suggestions** (`tracker.ts`): Aggregated `AVG(sc_amount) GROUP BY casino_id` to compute platform-wide average SC.

#### Active vs. Vestigial Columns

- `claimed_date`: The original UNIQUE constraint uses this column for calendar-day deduplication. With `reset_period_start` added for fixed-mode casinos, `claimed_date` is now partially redundant but still used in the UNIQUE constraint.

#### Data Volume Estimate

**Append-only, fast growth.** Every daily login generates a row. At 1,000 active users x 10 casinos x 365 days = 3.65M rows/year.

---

### `redemptions`

**Purpose:** Tracks all sweepstakes coin redemption requests from submission through fulfilment, providing the ground truth for financial P&L and redemption speed analytics.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | No FK constraint |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | |
| `sc_amount` | DECIMAL(10,2) | NO | -- | NOT NULL | Sweeps coins being redeemed |
| `usd_amount` | DECIMAL(10,2) | NO | -- | NOT NULL | Expected USD payout |
| `fees_usd` | DECIMAL(10,2) | YES | `0` | -- | Any fees deducted |
| `method` | redemption_method | NO | `'ach'` | NOT NULL | Payout method |
| `is_crypto` | BOOLEAN | YES | `FALSE` | -- | **Redundant** with `method = 'crypto'`. Schema debt. |
| `bank_note` | VARCHAR(255) | YES | NULL | -- | User's note about the bank/account used |
| `status` | redemption_status | NO | `'pending'` | NOT NULL | Current status in the lifecycle |
| `notes` | TEXT | YES | NULL | -- | User or admin notes |
| `submitted_at` | TIMESTAMP | YES | `NOW()` | -- | When redemption was requested |
| `confirmed_at` | TIMESTAMP | YES | NULL | -- | When funds were confirmed received |
| `cancelled_at` | TIMESTAMP | YES | NULL | -- | When cancelled (if applicable) |

#### Indexes

| Index | Columns |
|---|---|
| `redemptions_pkey` | `id` |
| `idx_redemptions_user_status` | `(user_id, status, submitted_at DESC)` |
| `idx_redemptions_casino_completed` | `(casino_id, status, confirmed_at DESC)` |

#### Relationships

- `ledger_entries.source_redemption_id` -> `redemptions.id` (trace ledger back to redemption)

#### Query Patterns

- **Redemption stats** (`redemption-stats.ts`): `SELECT EXTRACT(EPOCH FROM (confirmed_at - submitted_at)) / 86400.0 AS days FROM redemptions WHERE casino_id = $1 AND status = 'received' AND confirmed_at IS NOT NULL ORDER BY confirmed_at DESC LIMIT 1200`
- **Health trend** (`health.ts`): Aggregates `AVG(confirmed_at - submitted_at)` over 7-day and 30-day windows to compute redemption slowdown ratio.
- **User exposure** (`health.ts`): `SUM(r.usd_amount) FILTER (WHERE r.status = 'pending')` per casino.
- **Balance calculation** (`balance.ts`): `SUM(sc_amount) WHERE status = 'pending'` to subtract from available SC.
- **Ledger summary** (`api/ledger/summary.ts`): Joins to get pending redemption totals by casino.

#### Data Volume Estimate

**Append-only, moderate growth.** ~5-20 redemptions per user per month x user count.

---

### `ledger_entries`

**Purpose:** The central financial ledger recording every SC and USD transaction for each user at each casino, from daily claims and purchases to wagers and confirmed redemptions.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | No FK constraint |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | |
| `entry_type` | ledger_entry_type | NO | -- | NOT NULL | Transaction classification |
| `sc_amount` | DECIMAL(10,2) | YES | NULL | -- | SC value of this entry (positive = received, negative = spent) |
| `usd_amount` | DECIMAL(10,2) | YES | NULL | -- | USD value (used for purchases and redemptions) |
| `is_crypto` | BOOLEAN | YES | `FALSE` | -- | Whether the USD value is in cryptocurrency |
| `notes` | TEXT | YES | NULL | -- | User note |
| `source_redemption_id` | INT | YES | NULL | FK -> `redemptions.id` NO ACTION | Links a `redeem_confirmed` entry back to its redemption |
| `source_claim_id` | INT | YES | NULL | FK -> `daily_bonus_claims.id` NO ACTION | Links a `daily` entry back to its claim record |
| `linked_entry_id` | INT | YES | NULL | FK -> `ledger_entries.id` ON DELETE SET NULL | Self-referential link for paired entries (e.g. purchase + purchase_credit). Added via migration. |
| `link_id` | VARCHAR(255) | YES | NULL | -- | String grouping key for related entries. Purpose unclear; not observed in any TypeScript queries reviewed. Potentially vestigial or reserved for future use. |
| `margin_pct` | DECIMAL(8,4) | YES | NULL | -- | Purchase margin percentage. Added in dashboard-foundation migration. |
| `promo_code` | TEXT | YES | NULL | -- | Promo code used for this entry, if any. Added in dashboard-foundation migration. |
| `entry_at` | TIMESTAMPTZ | YES | `NOW()` | -- | Exact timestamp (timezone-aware). Converted from TIMESTAMP in dashboard-foundation migration. |
| `entry_date` | DATE | YES | `CURRENT_DATE` | -- | Calendar date for date-range filtering |

#### Indexes

| Index | Columns | Notes |
|---|---|---|
| `ledger_entries_pkey` | `id` | |
| `idx_ledger_user_casino_date` | `(user_id, casino_id, entry_date DESC)` | Primary read index for ledger API |
| `idx_ledger_user_type` | `(user_id, entry_type)` | Filters by entry type per user |
| `idx_ledger_linked_entry_id` | `linked_entry_id` | Defined in schema.sql |
| `idx_ledger_link_id` | `link_id` | Defined in schema.sql |
| `idx_ledger_user_casino_exists` | `(user_id, casino_id)` | Defined in schema.sql; checks if a user has any entries at a casino |
| `idx_ledger_entries_user_casino` | `(user_id, casino_id)` | **Duplicate** of `idx_ledger_user_casino_exists`. Added in `2026-03-17-add-indexes.sql` with different name. |
| `idx_ledger_user_date` | `(user_id, entry_at DESC)` | Added in dashboard-foundation migration |
| `idx_ledger_user_casino_type` | `(user_id, casino_id, entry_type)` | Added in dashboard-foundation migration |

#### Query Patterns

- **Available SC** (`balance.ts`): `SUM(sc_amount) WHERE user_id AND casino_id AND entry_type IN ('daily', 'free_sc', 'purchase_credit')`
- **Balance breakdown**: Grouped by `casino_id`, same type filter.
- **SC exposure** (`health.ts`): `SUM(CASE WHEN entry_type IN ('daily','free_sc','purchase_credit','adjustment') THEN sc_amount ELSE 0 END)` per casino.
- **Joined casinos** (`tracker.ts`): `SELECT DISTINCT casino_id FROM ledger_entries WHERE user_id = $1 AND casino_id = ANY($2)` -- checks whether a user has "joined" (interacted with) a casino.
- **Trust score** (`trust.ts`): `SUM(COALESCE(usd_amount, 0)) FROM ledger_entries WHERE user_id = $1` for net P&L.
- **Ledger API** (`api/ledger/entries.ts`): Filtered by `user_id`, optional `casino_id`, optional `entry_type`, optional date range; paginated at 20 per page.
- **CSV export**: All entries for user ordered by `entry_at DESC`.

#### Data Volume Estimate

**Append-only, fast growth.** Larger than `daily_bonus_claims` because it includes purchases, wagers, and winnings in addition to claims.

---

### `daily_aggregates`

**Purpose:** Pre-aggregated daily totals per user for dashboard performance (avoids expensive real-time ledger aggregations on every page load).

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `user_id` | TEXT | NO | -- | FK -> `user_settings.user_id` | |
| `agg_date` | DATE | NO | -- | | |
| `sc_earned` | DECIMAL(12,2) | YES | `0` | | Total SC earned that day |
| `usd_earned` | DECIMAL(10,2) | YES | `0` | | Total USD earned |
| `usd_spent` | DECIMAL(10,2) | YES | `0` | | Total USD spent |
| `purchase_count` | INT | YES | `0` | | Number of purchase entries |
| `claim_count` | INT | YES | `0` | | Number of daily claims |
| `free_sc_count` | INT | YES | `0` | | Number of free_sc entries |
| `updated_at` | TIMESTAMPTZ | YES | `NOW()` | | Last upsert time |
| -- | -- | -- | -- | PRIMARY KEY `(user_id, agg_date)` | |

#### Indexes

| Index | Columns |
|---|---|
| `daily_aggregates_pkey` | `(user_id, agg_date)` |
| `idx_daily_agg_recent` | `(user_id, agg_date DESC)` |

#### Active vs. Vestigial

The table is defined and indexed, but no write path was found in the reviewed lib or API files. It is likely populated either by a cron not yet reviewed, or it is a pre-launch placeholder. No SELECT queries were observed either. **Treat as inactive until confirmed otherwise.**

#### Data Volume Estimate

**Append-only / upsert, fast growth.** One row per user per day.

---

### `user_notifications`

**Purpose:** In-app notification inbox -- one row per notification delivered to a user, supporting unread counts and notification history.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | No FK constraint |
| `notification_type` | notification_type | NO | -- | NOT NULL | `state_pullout`, `ban_uptick`, or `system` |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | Referenced casino, if applicable |
| `state_code` | CHAR(2) | YES | NULL | -- | Referenced state, if applicable. No FK constraint. |
| `title` | VARCHAR(255) | NO | -- | NOT NULL | Short notification title |
| `message` | TEXT | NO | -- | NOT NULL | Full notification body |
| `action_url` | TEXT | YES | NULL | -- | Deep-link URL for the notification's call to action |
| `is_read` | BOOLEAN | YES | `FALSE` | -- | Whether the user has read this notification |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns |
|---|---|
| `user_notifications_pkey` | `id` |
| `idx_notifications_user_unread` | `(user_id, is_read, created_at DESC)` |

#### Query Patterns

- **Notification list** (`api/notifications/list.ts`): `WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, filtered by type.
- **Unread count**: `COUNT(*) WHERE user_id = $1 AND is_read = false`
- **Fan-out insert** (`notifications.ts`): Bulk INSERT via `SELECT FROM user_settings` (all), `SELECT FROM user_state_subscriptions` (state), or `SELECT DISTINCT FROM user_casino_settings` (casino).

#### Data Volume Estimate

**Append-only, fast growth.** Fan-outs can generate many rows at once (one per subscribed user).

---

### `user_notification_preferences`

**Purpose:** Stores per-user preferences for which types of push and email notifications they want to receive.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `user_id` | VARCHAR(255) | NO | -- | PRIMARY KEY, FK -> `user_settings.user_id` | |
| `push_warnings` | BOOLEAN | YES | `TRUE` | | Receive push notifications for platform warnings |
| `push_deals` | BOOLEAN | YES | `TRUE` | | Receive push for deal signals |
| `push_free_sc` | BOOLEAN | YES | `TRUE` | | Receive push for free SC signals |
| `push_streak_reminders` | BOOLEAN | YES | `FALSE` | | Receive daily streak reminder pushes |
| `email_digest_frequency` | VARCHAR(20) | YES | `'none'` | | Email digest cadence: `none`, `daily`, `weekly` |
| `updated_at` | TIMESTAMPTZ | YES | `NOW()` | | |

#### Query Patterns

- **Preferences GET/POST** (`api/notifications/preferences.ts`): Upsert on `user_id` conflict.

#### Data Volume Estimate

**Slow growth.** One row per user, created on first preference interaction.

---

### `admin_flags`

**Purpose:** Internal queue of items requiring admin attention -- automated anomalies, community reports escalated for review, or manually created audit entries.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `source` | VARCHAR(50) | NO | -- | NOT NULL | Origin of flag: `report`, `intel`, `manual`, `system`, etc. |
| `flag_type` | VARCHAR(50) | NO | -- | NOT NULL | Classification: `ban_report`, `state_report`, `reset_suggestion`, `data_anomaly`, etc. |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | |
| `state_code` | CHAR(2) | YES | NULL | -- | No FK constraint (schema debt) |
| `flag_content` | TEXT | NO | -- | NOT NULL | The full content of what triggered the flag |
| `ai_summary` | TEXT | YES | NULL | -- | AI-generated summary of the flag (if applicable) |
| `proposed_action` | TEXT | YES | NULL | -- | Suggested admin action; appended when admin adds notes |
| `status` | VARCHAR(20) | YES | `'pending'` | -- | `pending`, `actioned`, `dismissed` |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |
| `actioned_at` | TIMESTAMP | YES | NULL | -- | When the flag was resolved |
| `actioned_by` | VARCHAR(255) | YES | NULL | -- | Admin user ID who resolved the flag (no FK) |

#### Indexes

| Index | Columns | Condition |
|---|---|---|
| `admin_flags_pkey` | `id` | |
| `idx_admin_flags_status` | `(status, created_at DESC)` | |
| `idx_admin_flags_pending` | `id` | WHERE `status = 'pending'` |

#### Query Patterns

- **Admin dashboard**: Queries pending flags ordered by `created_at DESC`.
- **Flag action** (`api/admin/flag-action.ts`): Calls `markFlagStatus()` to UPDATE status, `actioned_at`, `actioned_by`.

#### Data Volume Estimate

**Append-only, slow-to-moderate growth.** Cleared via status updates, not deletes.

---

### `ban_reports`

**Purpose:** Community-submitted reports of account bans at casinos, used to detect elevated ban activity and trigger admin alerts.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | |
| `report_type` | VARCHAR(50) | NO | -- | NOT NULL | Type of ban: e.g. `promoban`, `hardban`, `shadowban` |
| `description` | TEXT | NO | -- | NOT NULL | Reporter's description of the ban |
| `reporter_ip_hash` | VARCHAR(64) | YES | NULL | -- | SHA-256 IP hash for deduplication |
| `reporter_user_id` | VARCHAR(255) | YES | NULL | -- | No FK constraint |
| `is_flagged` | BOOLEAN | YES | `FALSE` | -- | Admin flagged for review |
| `is_published` | BOOLEAN | YES | `FALSE` | -- | Published/actioned |
| `admin_notes` | TEXT | YES | NULL | -- | |
| `submitted_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns | Condition |
|---|---|---|
| `ban_reports_pkey` | `id` | |
| `idx_ban_reports_casino` | `(casino_id, is_published, submitted_at DESC)` | |
| `idx_ban_reports_pending` | `id` | WHERE `is_published = false` |

#### Data Volume Estimate

**Append-only, slow growth.** Occasional community submissions.

---

### `ban_uptick_alerts`

**Purpose:** Records automated alerts generated when ban report volume at a casino exceeds a threshold within a time window.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | |
| `report_count` | INT | NO | -- | NOT NULL | Number of reports that triggered the alert |
| `window_days` | INT | YES | `7` | | Rolling window evaluated |
| `is_active` | BOOLEAN | YES | `TRUE` | | Whether this alert is still active |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Active vs. Vestigial

No TypeScript queries for this table were found in the reviewed codebase. The generation logic (detecting uptick thresholds) may be unimplemented or handled by an unreviewed cron. **Treat as low-activity or pre-launch.**

#### Data Volume Estimate

**Slow growth.** One row per alert event.

---

### `auth_sessions`

**Purpose:** Stores active authentication sessions, linking session tokens (stored as hashes) to users, and supporting OTP-based passwordless login.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | The authenticated user's ID |
| `email` | VARCHAR(255) | NO | -- | NOT NULL | User's email at session creation time |
| `session_token_hash` | VARCHAR(64) | NO | -- | UNIQUE NOT NULL | SHA-256 hash of the session token stored in the cookie |
| `otp_token_hash` | VARCHAR(64) | YES | NULL | -- | SHA-256 hash of the OTP during the login flow; cleared after verification |
| `otp_expires_at` | TIMESTAMP | YES | NULL | -- | OTP expiry (15 minutes from generation) |
| `last_active_at` | TIMESTAMP | YES | `NOW()` | -- | Updated on every authenticated request; used for 90-day session expiry |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns |
|---|---|
| `auth_sessions_pkey` | `id` |
| `auth_sessions_session_token_hash_key` | `session_token_hash` (unique) |

**Missing index:** `(user_id)` -- used in `DELETE FROM auth_sessions WHERE session_token_hash = $1` (point lookup, covered by unique index) but also in logout by user (if implemented). Low priority.

#### Query Patterns

- **Session validation** (`auth.ts:validateSession`): `SELECT ... WHERE session_token_hash = $1 LIMIT 1`, then `UPDATE last_active_at`.
- **Session expiry**: Expired sessions deleted on next access attempt.
- **Logout** (`api/auth/logout.ts`): `DELETE FROM auth_sessions WHERE session_token_hash = $1`.
- **OTP verify** (`api/auth/verify-otp.ts`): Checks `otp_token_hash` and `otp_expires_at`, then clears OTP fields.

#### Data Volume Estimate

**Slow growth.** One active row per active session per user (90-day TTL). Rows are deleted on logout and expired sessions are pruned.

---

### `clicks`

**Purpose:** Append-only log of affiliate link clicks, recording which user clicked which casino link and from what referrer context.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | |
| `user_id` | VARCHAR(255) | YES | NULL | -- | No FK constraint; nullable for anonymous clicks |
| `referrer_source` | VARCHAR(50) | YES | NULL | -- | Context of the click (e.g. `tracker_suggestions`, `directory`) |
| `clicked_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Data Volume Estimate

**Append-only, moderate growth.** Every affiliate click generates a row.

---

### `email_waitlist`

**Purpose:** Captures emails of prospective users before they have a full account, with conversion tracking.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `email` | VARCHAR(255) | NO | -- | UNIQUE NOT NULL | |
| `source` | VARCHAR(50) | YES | NULL | -- | Where the signup came from (e.g. `landing_page`) |
| `captured_at` | TIMESTAMP | YES | `NOW()` | -- | |
| `converted_user_id` | VARCHAR(255) | YES | NULL | -- | The `user_id` they later registered with (no FK) |
| `converted_at` | TIMESTAMP | YES | NULL | -- | When they converted to a full account |

#### Data Volume Estimate

**Slow growth.** Append-only waitlist.

---

### `discord_intel_items`

**Purpose:** The central content store for all intelligence signals -- warnings, promos, free SC announcements -- sourced from Discord ingestion, admin creation, or user submissions.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `item_type` | VARCHAR(50) | NO | -- | NOT NULL | Signal type: `platform_warning`, `promo_code`, `flash_sale`, `free_sc`, `general_tip`, `playthrough_deal` |
| `casino_id` | INT | YES | NULL | FK -> `casinos.id` NO ACTION | Associated casino; NULL for platform-wide signals |
| `casino_name_raw` | VARCHAR(100) | YES | NULL | -- | Raw casino name from ingest when slug couldn't be resolved |
| `title` | VARCHAR(255) | NO | -- | NOT NULL | Signal headline |
| `content` | TEXT | NO | -- | NOT NULL | Full signal body (sanitized) |
| `content_hash` | VARCHAR(64) | YES | NULL | -- | SHA-256 of `title + content` for deduplication. Not enforced as UNIQUE -- checked manually in code. |
| `source_channel` | VARCHAR(100) | YES | NULL | -- | Discord channel name or `admin`/`user` |
| `is_published` | BOOLEAN | YES | `FALSE` | -- | Whether this signal is visible to end users |
| `expires_at` | TIMESTAMP | YES | NULL | -- | Optional expiry timestamp for time-limited signals |
| `confidence` | VARCHAR(20) | YES | `'unverified'` | -- | `high`, `medium`, `low`, `unverified` |
| `confidence_reason` | TEXT | YES | NULL | -- | Explanation of the confidence level |
| `auto_published` | BOOLEAN | YES | `FALSE` | -- | Whether published automatically by cron |
| `confirm_count` | INT | YES | `0` | -- | **Potentially vestigial.** Original reaction counter; superseded by `worked_count`. |
| `dispute_count` | INT | YES | `0` | -- | **Potentially vestigial.** Original dispute counter; superseded by `didnt_work_count`. |
| `source` | VARCHAR(20) | YES | `'discord'` | CHECK (`discord`, `admin`, `user`) | Signal origin. Added in intelligence-layer migration. |
| `submitted_by` | VARCHAR(255) | YES | NULL | -- | User ID if `source = 'user'`. No FK constraint. Added in intelligence-layer migration. |
| `is_anonymous` | BOOLEAN | YES | `FALSE` | -- | Whether the submitter chose to be anonymous. Added in intelligence-layer migration. |
| `worked_count` | INT | YES | `0` | -- | Count of `worked` votes from `signal_votes`. Added in intelligence-layer migration. |
| `didnt_work_count` | INT | YES | `0` | -- | Count of `didnt_work` votes. Added in intelligence-layer migration. |
| `signal_status` | TEXT | YES | `'active'` | CHECK (`active`, `conditional`, `likely_outdated`, `collapsed`) | Derived status based on vote ratios. Added in intelligence-layer migration. |
| `signal_priority` | VARCHAR(20) | YES | `'normal'` | -- | Priority bucket for feed ordering (`critical`, `high`, `normal`, `low`). Added in `v2-schema-foundation` migration. |
| `first_reporter_id` | VARCHAR(255) | YES | NULL | -- | Original reporter user ID for deduplication and confirmation tracking. Added in `v2-schema-foundation` migration. |
| `confirmation_count` | INT | YES | `0` | -- | Denormalized count of rows in `signal_confirmations`. Added in `v2-schema-foundation` migration. |
| `debunked_at` | TIMESTAMPTZ | YES | NULL | -- | Terminal-state timestamp for signals proven false. Added in `v2-schema-foundation` migration. |
| `state_tags` | TEXT[] | YES | NULL | -- | Optional array of state codes where the signal has been confirmed. Added in `v2-schema-foundation` migration. |
| `is_pinned` | BOOLEAN | YES | `FALSE` | -- | Admin sort override for curated feeds. Added in `v2-schema-foundation` migration. |
| `hold_until` | TIMESTAMPTZ | YES | NULL | -- | Delayed-publish timestamp used for trust-gated hold queues. Added in `v2-schema-foundation` migration. |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |
| `published_at` | TIMESTAMP | YES | NULL | -- | When the signal was published |

#### Indexes

| Index | Columns | Condition | Notes |
|---|---|---|---|
| `discord_intel_items_pkey` | `id` | | |
| `idx_discord_intel_published` | `(is_published, expires_at, created_at DESC)` | | Primary feed index |
| `idx_discord_intel_casino_published` | `(casino_id, is_published, created_at DESC)` | WHERE `is_published = true` | Tracker alert queries |
| `idx_discord_intel_source` | `source` | | Added in intelligence-layer migration |
| `idx_intel_items_casino_created` | `(casino_id, created_at DESC)` | WHERE `casino_id IS NOT NULL` | Added in `2026-03-17-add-indexes.sql` |
| `idx_intel_pinned` | `is_pinned` | WHERE `is_pinned = true` | Added in `v2-schema-foundation` migration |
| `idx_intel_hold` | `hold_until` | WHERE `hold_until IS NOT NULL` | Added in `v2-schema-foundation` migration |

#### Relationships

- `discord_intel_reactions.item_id` -> `discord_intel_items.id` CASCADE
- `signal_votes.signal_id` -> `discord_intel_items.id` NO ACTION
- `signal_confirmations.signal_id` -> `discord_intel_items.id` CASCADE
- `signal_updates.signal_id` -> `discord_intel_items.id` CASCADE

#### Query Patterns

- **Intel feed** (`intel.ts:getIntelFeed`): Filters `is_published = true AND casino_id = ANY($1) AND signal_status IN (active, conditional, likely_outdated)`, JOINs `casinos` and `user_settings` for contributor attribution; ordered by status priority then recency.
- **Health computation** (`health.ts`): Selects all `platform_warning` type signals that are published, with `casino_id IS NOT NULL`.
- **Tracker alerts** (`tracker.ts`): Filters `is_published = true AND (casino_id = ANY($1) OR casino_id IS NULL) AND item_type IN (...)`.
- **Trust score** (`trust.ts`): `SELECT COUNT, SUM(worked_count), SUM(didnt_work_count) FROM discord_intel_items WHERE submitted_by = $1 AND source = 'user'`.
- **Vote update** (`intel.ts:voteOnSignal`): Updates `worked_count` and `didnt_work_count` via subquery COUNT from `signal_votes`.

#### Active vs. Vestigial Columns

- `confirm_count` / `dispute_count`: No TypeScript code found reading or writing these. Superseded by `worked_count` / `didnt_work_count`. **Vestigial.**

#### Data Volume Estimate

**Append-only, fast growth.** Discord ingest can create many items per day. Signals are never deleted (only discarded via hard DELETE in `discardIntelItem`).

---

### `discord_intel_reactions`

**Purpose:** Records per-user emoji reactions to intel items from Discord (the original reaction system, predating the structured `signal_votes` voting system).

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `item_id` | INT | YES | NULL | FK -> `discord_intel_items.id` CASCADE | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | |
| `reaction` | VARCHAR(10) | NO | -- | NOT NULL | Emoji or reaction string |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |
| -- | -- | -- | -- | UNIQUE `(item_id, user_id)` | |

#### Active vs. Vestigial

**Likely vestigial.** No TypeScript code in the reviewed codebase references this table. The `signal_votes` table (with structured `worked`/`didnt_work` votes) appears to have replaced it. May be safe to deprecate.

#### Data Volume Estimate

**Dormant.** Unknown historical volume; not actively written.

---

### `signal_votes`

**Purpose:** Records structured community votes on intel signals -- whether a signal "worked" or "didn't work" -- used to compute signal status and contributor trust scores.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | PRIMARY KEY | UUID primary key (unlike most tables which use SERIAL) |
| `signal_id` | INT | NO | -- | NOT NULL, FK -> `discord_intel_items.id` NO ACTION | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL, FK -> `user_settings.user_id` NO ACTION | |
| `vote` | VARCHAR(12) | NO | -- | NOT NULL, CHECK (`worked`, `didnt_work`) | The vote cast |
| `created_at` | TIMESTAMPTZ | YES | `NOW()` | -- | |
| -- | -- | -- | -- | UNIQUE `(signal_id, user_id)` | One vote per user per signal |

#### Indexes

| Index | Columns | Notes |
|---|---|---|
| `signal_votes_pkey` | `id` | |
| `signal_votes_signal_id_user_id_key` | `(signal_id, user_id)` | Unique |
| `idx_signal_votes_signal` | `signal_id` | Defined in intelligence-layer migration |
| `idx_signal_votes_item` | `signal_id` | **Duplicate** of above. Defined in `2026-03-17-add-indexes.sql` with different name. |

#### Query Patterns

- **Vote cast** (`intel.ts:voteOnSignal`): Upsert on `(signal_id, user_id)` conflict; then updates `worked_count`/`didnt_work_count` in `discord_intel_items` via COUNT subqueries.
- **Trust computation** (`trust.ts`): `SUM(di.worked_count - di.didnt_work_count)` on `discord_intel_items` -- does not query `signal_votes` directly for trust; reads denormalized counts.

#### Data Volume Estimate

**Append-only, fast growth.** One row per user per signal vote.

---

### `signal_confirmations`

**Purpose:** Tracks which users confirmed an existing signal instead of creating a duplicate report, enabling future consolidated signal cards and deduplication windows.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `signal_id` | INT | NO | -- | NOT NULL, FK -> `discord_intel_items.id` ON DELETE CASCADE | Parent signal being confirmed |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | Confirming user ID (no FK constraint) |
| `created_at` | TIMESTAMPTZ | YES | `NOW()` | -- | Confirmation timestamp |
| -- | -- | -- | -- | UNIQUE `(signal_id, user_id)` | One confirmation per user per signal |

#### Indexes

| Index | Columns | Notes |
|---|---|---|
| `signal_confirmations_pkey` | `id` | |
| `signal_confirmations_signal_id_user_id_key` | `(signal_id, user_id)` | Unique |
| `idx_signal_confirmations_signal` | `signal_id` | Added in `v2-schema-foundation` migration |

#### Relationships

- `signal_id` -> `discord_intel_items.id` ON DELETE CASCADE

#### Query Patterns

No active query patterns yet -- table created as v2 schema foundation.

#### Data Volume Estimate

**Append-only, moderate growth.** One row per user confirmation event.

---

### `signal_updates`

**Purpose:** Append-only correction notes for signals, preserving a small audit trail of follow-up clarifications or fixes.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `signal_id` | INT | NO | -- | NOT NULL, FK -> `discord_intel_items.id` ON DELETE CASCADE | Parent signal |
| `author_id` | VARCHAR(255) | NO | -- | NOT NULL | Authoring user/admin ID |
| `content` | TEXT | NO | -- | NOT NULL | Correction/update body |
| `created_at` | TIMESTAMPTZ | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns | Notes |
|---|---|---|
| `signal_updates_pkey` | `id` | |
| `idx_signal_updates_signal` | `(signal_id, created_at)` | Added in `v2-schema-foundation` migration |

#### Relationships

- `signal_id` -> `discord_intel_items.id` ON DELETE CASCADE

#### Query Patterns

No active query patterns yet -- table created as v2 schema foundation.

#### Data Volume Estimate

**Append-only, low growth.** Max 3 rows per signal once the app-level limit is enforced.

---

### `casino_health`

**Purpose:** Caches the computed health status for each casino, updated by a cron job, incorporating warning signal weights and redemption timing trends.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `casino_id` | INT | NO | -- | PRIMARY KEY, FK -> `casinos.id` | One row per casino |
| `global_status` | VARCHAR(20) | NO | `'healthy'` | NOT NULL | Computed status: `healthy`, `watch`, `at_risk`, `critical` |
| `status_reason` | TEXT | YES | NULL | -- | Human-readable explanation of the status |
| `active_warning_count` | INT | YES | `0` | -- | Number of active (non-expired, non-collapsed) warning signals |
| `redemption_trend` | DECIMAL(6,2) | YES | NULL | -- | Ratio of recent-7d to 30d avg redemption time (>1.0 = slower) |
| `last_computed_at` | TIMESTAMPTZ | YES | `NOW()` | -- | When the cron last updated this row |
| `admin_override_status` | VARCHAR(20) | YES | NULL | -- | Admin-set manual override status (takes precedence over computed) |
| `admin_override_reason` | TEXT | YES | NULL | -- | Explanation for the override |
| `admin_override_at` | TIMESTAMPTZ | YES | NULL | -- | When the override was applied |
| `health_downgraded_at` | TIMESTAMPTZ | YES | NULL | -- | Timestamp of the most recent downgrade. Added in `v2-schema-foundation` migration. |
| `health_recovery_eligible_at` | TIMESTAMPTZ | YES | NULL | -- | Timestamp when recovery becomes eligible under sticky-health rules. Added in `v2-schema-foundation` migration. |
| `effective_status` | `health_status` | YES | `'healthy'` | -- | Sticky effective health state that can diverge from `global_status` once v2 transition logic is active. Added in `v2-schema-foundation` migration. |

#### Indexes

| Index | Columns |
|---|---|
| `casino_health_pkey` | `casino_id` |
| `idx_casino_health_status` | `global_status` |

#### Query Patterns

- **Tracker load** (`tracker.ts`): LEFT JOIN `casino_health ch ON ch.casino_id = c.id` -- reads `global_status` as `health_status`.
- **Health detail** (`health.ts:getCasinoHealth`): Point lookup by `casino_id`.
- **Health update** (`health.ts:computeAllCasinoHealth`): Upserts all casinos in a transaction; cron-driven.

#### Data Volume Estimate

**Static size.** One row per casino, updated in place.

---

### `events`

**Purpose:** Append-only event log for selective event sourcing of user actions, admin actions, and material state transitions.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | BIGSERIAL | NO | auto | PRIMARY KEY | |
| `event_type` | VARCHAR(50) | NO | -- | NOT NULL | Event category (`signal_submitted`, `trust_changed`, etc.) |
| `entity_type` | VARCHAR(50) | NO | -- | NOT NULL | Target entity namespace |
| `entity_id` | VARCHAR(255) | NO | -- | NOT NULL | Target entity identifier |
| `actor_type` | VARCHAR(20) | NO | -- | NOT NULL | Actor class (`user`, `admin`, `system`) |
| `actor_id` | VARCHAR(255) | YES | NULL | -- | Actor identifier when known |
| `old_value` | JSONB | YES | NULL | -- | Prior state snapshot |
| `new_value` | JSONB | YES | NULL | -- | New state snapshot |
| `metadata_json` | JSONB | YES | NULL | -- | Additional event metadata |
| `created_at` | TIMESTAMPTZ | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns | Notes |
|---|---|---|
| `events_pkey` | `id` | |
| `idx_events_entity` | `(entity_type, entity_id, created_at DESC)` | Added in `v2-schema-foundation` migration |
| `idx_events_type` | `(event_type, created_at DESC)` | Added in `v2-schema-foundation` migration |

#### Relationships

No foreign keys. IDs are stored as strings to match the existing loose user/entity conventions.

#### Query Patterns

No active query patterns yet -- table created as v2 schema foundation.

#### Data Volume Estimate

**Append-only, continuous growth.** Expected to grow steadily with material user/admin activity.

---

### `telemetry_events`

**Purpose:** Anonymous session-keyed telemetry for behavioral product signals such as feed views and signal expansions.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | BIGSERIAL | NO | auto | PRIMARY KEY | |
| `session_id` | VARCHAR(64) | NO | -- | NOT NULL | Anonymous client session key |
| `event_type` | VARCHAR(50) | NO | -- | NOT NULL | Telemetry event type |
| `entity_type` | VARCHAR(50) | YES | NULL | -- | Optional entity namespace |
| `entity_id` | VARCHAR(255) | YES | NULL | -- | Optional entity identifier |
| `metadata_json` | JSONB | YES | NULL | -- | Extra event payload |
| `created_at` | TIMESTAMPTZ | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns | Notes |
|---|---|---|
| `telemetry_events_pkey` | `id` | |
| `idx_telemetry_session` | `(session_id, created_at DESC)` | Added in `v2-schema-foundation` migration |
| `idx_telemetry_type` | `(event_type, created_at DESC)` | Added in `v2-schema-foundation` migration |

#### Relationships

No foreign keys. Telemetry is intentionally decoupled from user tables by default.

#### Query Patterns

No active query patterns yet -- table created as v2 schema foundation.

#### Data Volume Estimate

**Append-only, fast growth.** Expected to outpace user-generated event logs once batching is active.

---

### `moderation_actions`

**Purpose:** Audit trail for admin moderation actions and the future moderation delegation model.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `admin_id` | VARCHAR(255) | NO | -- | NOT NULL | Admin actor ID |
| `action_type` | VARCHAR(50) | NO | -- | NOT NULL | Moderation action performed |
| `entity_type` | VARCHAR(50) | NO | -- | NOT NULL | Target entity namespace |
| `entity_id` | VARCHAR(255) | NO | -- | NOT NULL | Target entity identifier |
| `reason` | TEXT | YES | NULL | -- | Optional audit reason |
| `created_at` | TIMESTAMPTZ | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns | Notes |
|---|---|---|
| `moderation_actions_pkey` | `id` | |
| `idx_moderation_entity` | `(entity_type, entity_id, created_at DESC)` | Added in `v2-schema-foundation` migration |
| `idx_moderation_admin` | `(admin_id, created_at DESC)` | Added in `v2-schema-foundation` migration |

#### Relationships

No foreign keys. Uses loose string IDs like the rest of the admin/audit layer.

#### Query Patterns

No active query patterns yet -- table created as v2 schema foundation.

#### Data Volume Estimate

**Append-only, low-to-moderate growth.** Expected to remain relatively small until moderation workflows expand.

---

### `trust_snapshots`

**Purpose:** Historical trust-score snapshots with per-component breakdowns for future trend charts and auditability.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | BIGSERIAL | NO | auto | PRIMARY KEY | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | User identifier (no FK constraint) |
| `trust_score` | NUMERIC(5,4) | NO | -- | NOT NULL | Overall trust score at snapshot time |
| `activity_score` | NUMERIC(5,4) | YES | NULL | -- | Activity component snapshot |
| `submission_score` | NUMERIC(5,4) | YES | NULL | -- | Submission-history component snapshot |
| `community_score` | NUMERIC(5,4) | YES | NULL | -- | Community component snapshot |
| `portfolio_score` | NUMERIC(5,4) | YES | NULL | -- | Portfolio component snapshot |
| `computed_at` | TIMESTAMPTZ | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns | Notes |
|---|---|---|
| `trust_snapshots_pkey` | `id` | |
| `idx_trust_snapshots_user` | `(user_id, computed_at DESC)` | Added in `v2-schema-foundation` migration |

#### Relationships

No foreign keys. Follows the existing loose `user_id` storage convention for audit/history tables.

#### Query Patterns

No active query patterns yet -- table created as v2 schema foundation.

#### Data Volume Estimate

**Append-only, moderate growth.** One or more rows per user per trust recompute policy.

---

### `admin_settings`

**Purpose:** Key-value configuration store for admin-controlled platform settings (e.g. auto-publish toggles).

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `key` | VARCHAR(50) | NO | -- | PRIMARY KEY | Setting name |
| `value` | TEXT | NO | -- | NOT NULL | Setting value (stored as string) |
| `updated_at` | TIMESTAMP | YES | `NOW()` | -- | |

Seeded with:
- `auto_publish_enabled` = `'false'`
- `auto_publish_delay_minutes` = `'120'`

#### Query Patterns

- **Auto-publish cron** (`api/cron/auto-publish.ts`): `SELECT value FROM admin_settings WHERE key = 'auto_publish_enabled'` and `'auto_publish_delay_minutes'`.
- **Admin settings** (`api/admin/settings.ts`): Read and update individual keys.

#### Data Volume Estimate

**Static.** A handful of rows; changes are rare.

---

### `push_subscriptions`

**Purpose:** Stores Web Push API subscription objects for users who have enabled browser/PWA push notifications.

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | No FK constraint |
| `subscription_json` | TEXT | NO | -- | NOT NULL | Full JSON of the browser PushSubscription object (endpoint + keys) |
| `created_at` | TIMESTAMP | YES | `NOW()` | -- | |
| `is_active` | BOOLEAN | YES | `TRUE` | -- | Set to `false` when endpoint returns 404/410 (expired subscription) |

#### Indexes

| Index | Columns | Condition |
|---|---|---|
| `push_subscriptions_pkey` | `id` | |
| `idx_push_subs_user_active` | `user_id` | WHERE `is_active = true` |

#### Query Patterns

- **Push to user** (`push.ts:sendPushToUser`): `SELECT ... WHERE user_id = $1 AND is_active = true`
- **Push to state segment**: JOINs `user_state_subscriptions` by `state_code`
- **Push to casino segment**: JOINs `user_casino_settings` by `casino_id` with `removed_at IS NULL`
- **Push to all**: `SELECT ... WHERE is_active = true`
- **Deactivation**: `UPDATE SET is_active = false WHERE id = $1` on 404/410 from push provider.

#### Data Volume Estimate

**Slow growth.** One active row per device per user. Grows with PWA adoption.

---

### `push_notification_log`

**Purpose:** Rate-limiting log of push notifications sent to users, preventing notification fatigue (max 3 per user per 24 hours).

#### Columns

| Column | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PRIMARY KEY | |
| `user_id` | VARCHAR(255) | NO | -- | NOT NULL | |
| `payload_title` | VARCHAR(255) | YES | NULL | -- | Title of the notification sent |
| `sent_at` | TIMESTAMP | YES | `NOW()` | -- | |

#### Indexes

| Index | Columns |
|---|---|
| `push_notification_log_pkey` | `id` |
| `idx_push_log_user_day` | `(user_id, sent_at DESC)` |

#### Query Patterns

- **Rate limit check** (`push.ts:canSendToUser`): `COUNT(*) WHERE user_id = $1 AND sent_at > NOW() - INTERVAL '24 hours'`
- **Log entry** (`push.ts:logPush`): INSERT on every delivered push.

#### Data Volume Estimate

**Append-only, rolling log.** Could be partitioned or pruned by time; old rows beyond 24h are functionally useless for rate limiting.

---

## Table Dependency Graph

```
user_settings (no deps)
    ↑ signal_votes.user_id (FK, NO ACTION)
    ↑ user_notification_preferences.user_id (FK, PK)
    ↑ daily_aggregates.user_id (FK)
    ↑ [implicit] auth_sessions.user_id
    ↑ [implicit] user_casino_settings.user_id
    ↑ [implicit] daily_bonus_claims.user_id
    ↑ [implicit] redemptions.user_id
    ↑ [implicit] ledger_entries.user_id
    ↑ [implicit] discord_intel_items.submitted_by
    ↑ [implicit] clicks.user_id
    ↑ [implicit] push_subscriptions.user_id
    ↑ [implicit] push_notification_log.user_id

state_legal_status (no deps)
    ↑ provider_state_availability.state_code (FK CASCADE)
    ↑ casino_state_availability.state_code (FK CASCADE)
    ↑ user_state_subscriptions.state_code (FK)
    ↑ [implicit] admin_flags.state_code
    ↑ [implicit] state_pullout_alerts.state_code
    ↑ [implicit] user_notifications.state_code

game_providers (no deps)
    ↑ casino_live_game_providers.provider_id (FK CASCADE)
    ↑ provider_state_availability.provider_id (FK CASCADE)
    ↑ casino_game_availability.provider_id (FK NO ACTION)
    ↑ game_volatility_reports.provider_id (FK NO ACTION)
    ↑ state_pullout_alerts.provider_id (FK NO ACTION)
    ↑ state_availability_reports.provider_id (FK NO ACTION)

casinos (no deps)
    ↑ casino_live_game_providers.casino_id (FK CASCADE)
    ↑ casino_game_availability.casino_id (FK CASCADE)
    ↑ game_volatility_reports.casino_id (FK CASCADE)
    ↑ user_casino_settings.casino_id (FK CASCADE)
    ↑ casino_state_availability.casino_id (FK CASCADE)
    ↑ casino_health.casino_id (FK PK)
    ↑ state_pullout_alerts.casino_id (FK NO ACTION) <- blocks delete
    ↑ reset_time_suggestions.casino_id (FK NO ACTION) <- blocks delete
    ↑ daily_bonus_claims.casino_id (FK NO ACTION) <- blocks delete
    ↑ redemptions.casino_id (FK NO ACTION) <- blocks delete
    ↑ ledger_entries.casino_id (FK NO ACTION) <- blocks delete
    ↑ user_notifications.casino_id (FK NO ACTION) <- blocks delete
    ↑ admin_flags.casino_id (FK NO ACTION) <- blocks delete
    ↑ ban_reports.casino_id (FK NO ACTION) <- blocks delete
    ↑ ban_uptick_alerts.casino_id (FK NO ACTION) <- blocks delete
    ↑ clicks.casino_id (FK NO ACTION) <- blocks delete
    ↑ discord_intel_items.casino_id (FK NO ACTION) <- blocks delete
    ↑ state_availability_reports.casino_id (FK NO ACTION) <- blocks delete

discord_intel_items -> casinos
    ↑ discord_intel_reactions.item_id (FK CASCADE)
    ↑ signal_votes.signal_id (FK NO ACTION) <- blocks delete

redemptions -> casinos
    ↑ ledger_entries.source_redemption_id (FK NO ACTION)

daily_bonus_claims -> casinos
    ↑ ledger_entries.source_claim_id (FK NO ACTION)

ledger_entries -> casinos, redemptions, daily_bonus_claims
    ↑ ledger_entries.linked_entry_id (self-referential FK ON DELETE SET NULL)
```

### Deletion Cascade Summary

| Delete target | Cascades | Blocked by (NO ACTION FKs) |
|---|---|---|
| `casinos` | `casino_live_game_providers`, `casino_game_availability`, `game_volatility_reports`, `user_casino_settings`, `casino_state_availability`, `casino_health` | `state_pullout_alerts`, `reset_time_suggestions`, `daily_bonus_claims`, `redemptions`, `ledger_entries`, `user_notifications`, `admin_flags`, `ban_reports`, `ban_uptick_alerts`, `clicks`, `discord_intel_items`, `state_availability_reports` |
| `game_providers` | `casino_live_game_providers`, `provider_state_availability` | Nothing (other FKs are nullable NO ACTION) |
| `discord_intel_items` | `discord_intel_reactions` | `signal_votes` |
| `user_settings` | `user_notification_preferences`, `daily_aggregates` | `signal_votes` |

> **Operational note:** Deleting a casino directly is nearly impossible once it has any activity. Use `is_excluded = true` for soft-disabling instead.

---

## Migration History

Migrations are listed in approximate execution order. The `push-notification-log.sql` file has no date prefix and its order relative to other 2026-03-16 and 2026-03-17 migrations is ambiguous.

| File | Date | Summary |
|---|---|---|
| `migrations/schema.sql` | Baseline | Full initial schema: all core tables, enums, base indexes, and `admin_settings` seed data |
| `migrations/seed-states.sql` | Baseline | Seeds `state_legal_status` with all 50 US states + DC |
| `migrations/push-notification-log.sql` | Unknown | Creates `push_notification_log` table with user rate-limiting index |
| `migrations/2026-03-15-dashboard-foundation.sql` | 2026-03-15 | Adds goal/momentum/KPI columns to `user_settings`; adds `purchase` and `free_sc` enum values; converts `ledger_entries.entry_at` to TIMESTAMPTZ; adds `margin_pct` and `promo_code` to `ledger_entries`; adds `reset_period_start` to `daily_bonus_claims`; creates `daily_aggregates` table with aggregate indexes |
| `migrations/2026-03-16-casinos-website-url.sql` | 2026-03-16 | Adds `website_url TEXT` column to `casinos` |
| `migrations/2026-03-16-linked-entries.sql` | 2026-03-16 | Adds `purchase_credit` to `ledger_entry_type` enum; adds `linked_entry_id` self-referential FK to `ledger_entries`; creates `idx_ledger_linked_entry_id` |
| `migrations/2026-03-16-phase1-reset-columns.sql` | 2026-03-16 | Adds `no_daily_reward` to `user_casino_settings` and `reset_mode`/`reset_interval_hours` to `casinos` (idempotent via `IF NOT EXISTS`); adds CHECK constraint on `reset_mode`; references `streak_mode` in UPDATE (see schema debt) |
| `migrations/2026-03-16-suggested-normalized.sql` | 2026-03-16 | Adds `normalized_name` to `casinos`; backfills normalized values; creates `idx_casinos_normalized_name` |
| `migrations/2026-03-16-tier-label.sql` | 2026-03-16 | Adds `tier_label VARCHAR(2)` to `casinos` |
| `migrations/2026-03-16-user-casino-settings-notes.sql` | 2026-03-16 | Adds `notes TEXT` to `user_casino_settings` |
| `migrations/2026-03-17-add-indexes.sql` | 2026-03-17 | Adds 5 performance indexes: `idx_user_casino_settings_user_active` (duplicate), `idx_daily_bonus_claims_user_casino_date`, `idx_ledger_entries_user_casino` (duplicate), `idx_intel_items_casino_created`, `idx_signal_votes_item` (duplicate) |
| `migrations/2026-03-17-intelligence-layer.sql` | 2026-03-17 | Creates `casino_health`, `user_notification_preferences`, and `signal_votes` tables; adds `layout_swap` and `contributor_tier` to `user_settings`; changes `trust_score` default to `0.50`; adds `source`, `submitted_by`, `is_anonymous`, `worked_count`, `didnt_work_count`, `signal_status` to `discord_intel_items`; adds CHECK constraints on new columns; creates indexes |
| `migrations/v2-schema-foundation.sql` | 2026-03-17 | Adds v2 schema foundation: `health_status` enum, new signal lifecycle columns on `discord_intel_items`, new `signal_confirmations`, `signal_updates`, `events`, `telemetry_events`, `moderation_actions`, and `trust_snapshots` tables, plus sticky-health and anonymous-preference columns and supporting indexes |
| `migrations/v2-schema-backfill.sql` | 2026-03-17 | Backfills `discord_intel_items.signal_priority`, `discord_intel_items.first_reporter_id`, and `casino_health.effective_status` from existing data |
| `migrations/fix-trust-snapshot-precision.sql` | 2026-03-17 | Widens trust_snapshots score columns from DECIMAL(3,2) to NUMERIC(5,4) for sparkline fidelity |

---

## Known Schema Debt

### 1. Vestigial `casinos.tier` column
The base schema defines `tier VARCHAR(1) DEFAULT 'B'` and `idx_casinos_tier` indexes it. The migration `2026-03-16-tier-label.sql` added `tier_label VARCHAR(2)`, and all TypeScript code uses `c.tier_label AS tier`. The old `tier` column is never read by application code. The index on it wastes space.

**Resolution:** Drop `idx_casinos_tier`, drop `tier` column, rename `tier_label` to `tier`.

---

### 2. Duplicate indexes
The following functionally-identical indexes exist under two names:

| Table | Index 1 (schema.sql) | Index 2 (migration) |
|---|---|---|
| `user_casino_settings` | `idx_ucs_user_active` | `idx_user_casino_settings_user_active` |
| `ledger_entries` | `idx_ledger_user_casino_exists` | `idx_ledger_entries_user_casino` |
| `signal_votes` | `idx_signal_votes_signal` | `idx_signal_votes_item` |

Each duplicated index wastes write overhead and storage with no benefit.

**Resolution:** Drop the migration-created duplicates (`idx_user_casino_settings_user_active`, `idx_ledger_entries_user_casino`, `idx_signal_votes_item`).

---

### 3. `streak_mode` reference in migration
`2026-03-16-phase1-reset-columns.sql` includes:
```sql
UPDATE casinos SET reset_mode = COALESCE(streak_mode, 'rolling') ...
```
The column `streak_mode` is never defined in `schema.sql` or any other migration. Running this migration on a fresh database will fail. This suggests either (a) `streak_mode` was a column in a pre-`schema.sql` version that was removed, or (b) the migration was never run on a fresh database.

**Resolution:** Replace `streak_mode` reference with `'rolling'` since the column doesn't exist, or confirm the migration is not intended to run from scratch.

---

### 4. `discord_intel_items.content_hash` not UNIQUE
The `content_hash` column is used for deduplication via a manual `SELECT ... WHERE content_hash = $1` before insert. If two concurrent ingests race, both will pass the check and insert duplicate content. There is no database-level uniqueness guarantee.

**Resolution:** Add `UNIQUE` constraint on `content_hash` (with NULL exclusion) and use `INSERT ... ON CONFLICT DO NOTHING`.

---

### 5. `user_casino_settings.personal_notes` vs. `notes`
The base schema defines `personal_notes TEXT`. A migration added `notes TEXT`. The tracker TypeScript interface uses `personal_notes`. The notes API endpoint appears to target `notes`. Both columns coexist with unclear delineation.

**Resolution:** Determine which column the notes endpoint writes to; deprecate and backfill the other.

---

### 6. `redemptions.is_crypto` redundant with `method = 'crypto'`
The `is_crypto BOOLEAN` flag is redundant with `method = redemption_method` which already has a `crypto` value. One of these should be the authoritative source; the other should be derived or removed.

**Resolution:** Either derive `is_crypto` as a computed column or remove it and use `method = 'crypto'` everywhere.

---

### 7. Missing FK constraints on `state_code` columns
Several tables store state codes without FK constraints to `state_legal_status`:
- `admin_flags.state_code`
- `state_pullout_alerts.state_code`
- `state_availability_reports.state_code`
- `user_notifications.state_code`

Invalid state codes could be inserted silently.

**Resolution:** Add FK constraints or at minimum a CHECK constraint against the known set.

---

### 8. Missing FK constraints on `user_id` columns
Most tables store `user_id VARCHAR(255)` with no FK to `user_settings.user_id`. If a user is deleted, orphaned rows would accumulate silently. This is a deliberate or oversight trade-off (Neon serverless, no cascades desired).

**Tables affected:** `auth_sessions`, `user_casino_settings`, `daily_bonus_claims`, `redemptions`, `ledger_entries`, `user_notifications`, `clicks`, `push_subscriptions`, `push_notification_log`, `discord_intel_items.submitted_by`, `ban_reports.reporter_user_id`, etc.

---

### 9. `discord_intel_items.confirm_count` / `dispute_count` vestigial
Original vote counters from before the `signal_votes` / `worked_count` / `didnt_work_count` system. No TypeScript code writes or reads them. They consume storage for every intel item.

**Resolution:** Drop `confirm_count` and `dispute_count` after confirming they are unused.

---

### 10. `discord_intel_reactions` table appears vestigial
No TypeScript code in the reviewed codebase references this table. The structured `signal_votes` table has superseded it.

**Resolution:** Confirm disuse, archive any historical data, and drop the table.

---

### 11. `game_volatility_reports` and `ban_uptick_alerts` appear unimplemented
Neither table has any API endpoint or lib function that creates, reads, or updates rows in the reviewed codebase. Both may be pre-launch placeholders.

---

### 12. `daily_aggregates` appears unimplemented
The table is defined and indexed but no write or read path was found in the reviewed lib files or API routes. Either it is populated by an unreviewed cron, or it is pre-launch.

---

### 13. `ledger_entries.link_id` purpose is unclear
`link_id VARCHAR(255)` has its own index (`idx_ledger_link_id`) but was not observed in any TypeScript queries. It is distinct from `linked_entry_id` (the self-referential INT FK). Its intended use case is undocumented.

---

### 14. `push-notification-log.sql` has no date prefix
This migration file has no date in its filename, making its position in the migration order ambiguous. It should be renamed with a date prefix.

---

### 15. `casinos.reset_mode` and `reset_interval_hours` defined in both schema and migration
`schema.sql` already defines both columns, but `2026-03-16-phase1-reset-columns.sql` also `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for both. Idempotent due to `IF NOT EXISTS`, but confusing. Similarly for `user_casino_settings.no_daily_reward`.

---

## Recommended Indexes

Based on query patterns observed in `src/lib/` and `src/pages/api/`, the following indexes are recommended in addition to resolving duplicates noted above:

| Table | Columns | Type | Rationale |
|---|---|---|---|
| `redemptions` | `(user_id, casino_id, status)` | B-tree | `health.ts` and `balance.ts` filter by all three; current index covers `(user_id, status)` only |
| `ledger_entries` | `(user_id, casino_id, entry_type)` | B-tree | `balance.ts` and `health.ts` filter on `entry_type IN (...)` per user+casino; partially covered by `idx_ledger_user_casino_type` (added in dashboard migration) -- verify that index is active |
| `discord_intel_items` | `(submitted_by, source)` | B-tree | `trust.ts:computeTrustScore` queries `WHERE submitted_by = $1 AND source = 'user'` -- no covering index today |
| `casinos` | `(is_excluded, source)` | B-tree | `getTrackerSuggestions` filters `is_excluded = false AND source = 'admin'`; full scan today |
| `auth_sessions` | `(user_id)` | B-tree | Logout by user, session cleanup |
| `signal_votes` | `(user_id)` | B-tree | May be needed if per-user vote history is queried |
| `daily_bonus_claims` | `(user_id, casino_id, claim_type, claimed_at DESC)` | B-tree | Current `idx_daily_bonus_claims_user_casino_date` uses `claimed_at`; the LATERAL subquery in tracker status would benefit from a tighter composite |
| `casino_live_game_providers` | `(provider_id)` | B-tree | Admin cascade query searches by `provider_id` alone; currently only the PK `(casino_id, provider_id)` exists |

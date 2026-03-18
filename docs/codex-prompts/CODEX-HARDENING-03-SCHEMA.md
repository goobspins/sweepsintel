# Hardening Step 3: v2 Schema Foundation

## Context

Steps 1, 1B, and 2 are complete. We have 41 tests (all passing), pure computation helpers extracted from trust.ts and health.ts, and a `withRoute()` helper with 10 migrated endpoints.

This step adds all v2 tables and columns in a single migration file. **No behavior changes.** The application continues to work exactly as before. New columns have defaults or are nullable. New tables are empty until v2 feature code starts writing to them.

**Stack**: Astro 4.0 (hybrid mode) + React 18 + Neon Postgres + raw SQL. No ORM. No Tailwind.

## What Already Exists

Read these files before starting:

- `src/db/migrations/schema.sql` -- current base schema
- Any migration files in `src/db/migrations/` -- to understand existing column additions and naming conventions
- `docs/active/schema-reference.md` -- canonical schema documentation (this gets updated in Phase 3)

Key existing tables you'll be modifying:
- `discord_intel_items` -- has columns: id, item_type, casino_id, title, content, content_hash, source, submitted_by, is_anonymous, worked_count, didnt_work_count, signal_status, is_published, expires_at, confidence, created_at, published_at, etc.
- `casino_health` -- has columns: casino_id, global_status, status_reason, active_warning_count, redemption_trend, last_computed_at, admin_override_status, admin_override_reason, admin_override_at
- `user_settings` -- has columns: user_id, trust_score, trust_score_updated_at, contributor_tier, home_state, is_admin, timezone, created_at, updated_at, plus various dashboard/layout columns

## Phase 1: Create the Migration File

Create a single migration file: `src/db/migrations/v2-schema-foundation.sql`

Look at existing migration files in `src/db/migrations/` to match the naming convention (date prefix, etc.). If other migrations use a date prefix like `2026-03-17-*.sql`, use today's date or the next available.

### 1A: New Enum Type

```sql
-- Health status enum for the new effective_status column
CREATE TYPE health_status AS ENUM ('healthy', 'watch', 'at_risk', 'critical');
```

**Important:** The existing `casino_health.global_status` column is VARCHAR(20), not this enum. The new `effective_status` column will use the enum. Don't change `global_status` -- it stays as-is.

### 1B: Alter `discord_intel_items`

Add these columns:

```sql
ALTER TABLE discord_intel_items
  ADD COLUMN IF NOT EXISTS signal_priority VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS first_reporter_id VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmation_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS debunked_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS state_tags TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hold_until TIMESTAMPTZ DEFAULT NULL;
```

Column purposes (for reference, don't include as comments in SQL):
- `signal_priority`: critical/high/normal/low -- maps from item_type in v2 feature code
- `first_reporter_id`: user_id of original submitter for dedup/confirmation tracking
- `confirmation_count`: number of times other users confirmed this signal
- `debunked_at`: timestamp when the signal was debunked (distinct from expired)
- `state_tags`: array of US state codes where this signal has been confirmed
- `is_pinned`: admin can pin signals to override algorithmic sort
- `hold_until`: delayed publishing timestamp for trust-gated hold queue

### 1C: New `signal_confirmations` Table

```sql
CREATE TABLE IF NOT EXISTS signal_confirmations (
  id SERIAL PRIMARY KEY,
  signal_id INT NOT NULL REFERENCES discord_intel_items(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (signal_id, user_id)
);
```

Purpose: tracks which users confirmed an existing signal (dedup merging).

### 1D: New `signal_updates` Table

```sql
CREATE TABLE IF NOT EXISTS signal_updates (
  id SERIAL PRIMARY KEY,
  signal_id INT NOT NULL REFERENCES discord_intel_items(id) ON DELETE CASCADE,
  author_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Purpose: append-only correction notes on signals (max 3 per signal enforced in app code, not schema).

### 1E: New `events` Table

```sql
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  actor_type VARCHAR(20) NOT NULL,
  actor_id VARCHAR(255) DEFAULT NULL,
  old_value JSONB DEFAULT NULL,
  new_value JSONB DEFAULT NULL,
  metadata_json JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Purpose: selective event sourcing. Only meaningful state changes get logged (user actions, material trust/health transitions, admin actions). Uses BIGSERIAL because this table will grow continuously.

### 1F: New `telemetry_events` Table

```sql
CREATE TABLE IF NOT EXISTS telemetry_events (
  id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) DEFAULT NULL,
  entity_id VARCHAR(255) DEFAULT NULL,
  metadata_json JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Purpose: anonymous behavioral telemetry (feed_view, signal_expand, casino_track, etc.). Keyed to session, not user, by default.

### 1G: Alter `user_settings`

```sql
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS anonymous_preference BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trust_last_activity_at TIMESTAMPTZ DEFAULT NULL;
```

- `anonymous_preference`: default true per founder decision (signals default anonymous, sticky preference)
- `trust_last_activity_at`: tracks last meaningful activity for trust decay computation

### 1H: Alter `casino_health`

```sql
ALTER TABLE casino_health
  ADD COLUMN IF NOT EXISTS health_downgraded_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS health_recovery_eligible_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS effective_status health_status DEFAULT 'healthy';
```

- `health_downgraded_at`: when health was last downgraded (for cool-down calculation)
- `health_recovery_eligible_at`: computed timestamp when recovery becomes eligible (14/30/60 days)
- `effective_status`: the sticky health status (may differ from computed `global_status`)

### 1I: New `moderation_actions` Table

```sql
CREATE TABLE IF NOT EXISTS moderation_actions (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Purpose: audit trail for admin moderation (pin, override, moderate). Skeleton for future delegation infra.

### 1J: New `trust_snapshots` Table

```sql
CREATE TABLE IF NOT EXISTS trust_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  trust_score DECIMAL(3,2) NOT NULL,
  activity_score DECIMAL(3,2) DEFAULT NULL,
  submission_score DECIMAL(3,2) DEFAULT NULL,
  community_score DECIMAL(3,2) DEFAULT NULL,
  portfolio_score DECIMAL(3,2) DEFAULT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
```

Purpose: trust score history with per-component breakdown. Powers future sparkline UI and trust trend analysis.

### 1K: Indexes for New Tables and Columns

```sql
-- Events: query by entity
CREATE INDEX IF NOT EXISTS idx_events_entity ON events (entity_type, entity_id, created_at DESC);
-- Events: query by type
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type, created_at DESC);

-- Telemetry: query by session
CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_events (session_id, created_at DESC);
-- Telemetry: query by event type
CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_events (event_type, created_at DESC);

-- Signal confirmations: lookup by signal
CREATE INDEX IF NOT EXISTS idx_signal_confirmations_signal ON signal_confirmations (signal_id);

-- Signal updates: lookup by signal
CREATE INDEX IF NOT EXISTS idx_signal_updates_signal ON signal_updates (signal_id, created_at);

-- Trust snapshots: lookup by user (for sparkline)
CREATE INDEX IF NOT EXISTS idx_trust_snapshots_user ON trust_snapshots (user_id, computed_at DESC);

-- Moderation actions: lookup by entity
CREATE INDEX IF NOT EXISTS idx_moderation_entity ON moderation_actions (entity_type, entity_id, created_at DESC);
-- Moderation actions: lookup by admin
CREATE INDEX IF NOT EXISTS idx_moderation_admin ON moderation_actions (admin_id, created_at DESC);

-- Intel items: index for pinned signals
CREATE INDEX IF NOT EXISTS idx_intel_pinned ON discord_intel_items (is_pinned) WHERE is_pinned = true;
-- Intel items: index for hold queue
CREATE INDEX IF NOT EXISTS idx_intel_hold ON discord_intel_items (hold_until) WHERE hold_until IS NOT NULL;
```

**Commit message**: `feat: add v2 schema foundation -- new tables, columns, and indexes`
**Run `npm run check:full` after this phase.**

## Phase 2: Backfill Existing Data

Create a separate migration file: `src/db/migrations/v2-schema-backfill.sql` (or append to the same file with clear section separators -- match whatever pattern existing migrations use).

### 2A: Backfill `signal_priority` from `item_type`

```sql
UPDATE discord_intel_items SET signal_priority = CASE
  WHEN item_type = 'platform_warning' THEN 'critical'
  WHEN item_type IN ('flash_sale', 'promo_code') THEN 'high'
  WHEN item_type IN ('free_sc', 'playthrough_deal') THEN 'normal'
  WHEN item_type = 'general_tip' THEN 'low'
  ELSE 'normal'
END
WHERE signal_priority = 'normal' OR signal_priority IS NULL;
```

### 2B: Backfill `first_reporter_id` from `submitted_by`

```sql
UPDATE discord_intel_items
SET first_reporter_id = submitted_by
WHERE submitted_by IS NOT NULL
  AND is_anonymous = false
  AND first_reporter_id IS NULL;
```

Only backfill for non-anonymous submissions. Anonymous submitters don't get first-reporter credit in the public-facing system (though the system knows who they are via `submitted_by` for trust computation).

### 2C: Backfill `effective_status` from `global_status`

```sql
UPDATE casino_health SET effective_status = CASE
  WHEN admin_override_status IS NOT NULL THEN admin_override_status::health_status
  WHEN global_status = 'healthy' THEN 'healthy'::health_status
  WHEN global_status = 'watch' THEN 'watch'::health_status
  WHEN global_status = 'at_risk' THEN 'at_risk'::health_status
  WHEN global_status = 'critical' THEN 'critical'::health_status
  ELSE 'healthy'::health_status
END;
```

This ensures `effective_status` starts in sync with current state. Step 5 (health refactor) will make these diverge when sticky behavior kicks in.

**Commit message**: `data: backfill signal_priority, first_reporter_id, and effective_status`
**Run `npm run check:full` after this phase.**

## Phase 3: Update Schema Reference

Update `docs/active/schema-reference.md` to document all new tables and columns added in this step.

For each new table, add a section following the existing format:
- **Purpose** description
- **Columns** table
- **Indexes** table
- **Relationships** (FK references)
- **Query Patterns** (write "No active query patterns yet -- table created as v2 schema foundation" for new tables)
- **Data Volume Estimate**

For altered tables (`discord_intel_items`, `casino_health`, `user_settings`), add the new columns to the existing column tables and note they were "Added in v2-schema-foundation migration."

Add all new tables to the Table of Contents at the top.

**Commit message**: `docs: update schema reference with v2 tables and columns`
**Run `npm run check:full` after this phase.**

## Constraints

- **DO NOT** change any TypeScript code. No `.ts` files modified. This is a pure schema migration.
- **DO NOT** install new dependencies.
- **DO NOT** change any existing column types, defaults, or constraints. Only ADD new columns and tables.
- **DO NOT** drop or rename any existing columns (including vestigial ones like `confirm_count`/`dispute_count`).
- **DO NOT** add any foreign key from `user_settings` to new tables that reference `user_id` -- the codebase uses VARCHAR user IDs without FK constraints in many places. Follow the existing pattern.
- All 41 existing tests must still pass (schema changes don't affect test mocks).
- `npm run check:full` must pass after every phase.
- Use `IF NOT EXISTS` / `IF NOT EXISTS` guards on all CREATE and ALTER statements so the migration is idempotent.
- Keep column naming consistent with existing conventions: snake_case, `_at` suffix for timestamps, `_id` suffix for foreign keys.

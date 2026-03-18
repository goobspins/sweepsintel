DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'health_status'
  ) THEN
    CREATE TYPE health_status AS ENUM ('healthy', 'watch', 'at_risk', 'critical');
  END IF;
END $$;

ALTER TABLE discord_intel_items
  ADD COLUMN IF NOT EXISTS signal_priority VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS first_reporter_id VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmation_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS debunked_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS state_tags TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hold_until TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS signal_confirmations (
  id SERIAL PRIMARY KEY,
  signal_id INT NOT NULL REFERENCES discord_intel_items(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (signal_id, user_id)
);

CREATE TABLE IF NOT EXISTS signal_updates (
  id SERIAL PRIMARY KEY,
  signal_id INT NOT NULL REFERENCES discord_intel_items(id) ON DELETE CASCADE,
  author_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS telemetry_events (
  id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) DEFAULT NULL,
  entity_id VARCHAR(255) DEFAULT NULL,
  metadata_json JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS anonymous_preference BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trust_last_activity_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE casino_health
  ADD COLUMN IF NOT EXISTS health_downgraded_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS health_recovery_eligible_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS effective_status health_status DEFAULT 'healthy';

CREATE TABLE IF NOT EXISTS moderation_actions (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_events_entity ON events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_confirmations_signal ON signal_confirmations (signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_updates_signal ON signal_updates (signal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_trust_snapshots_user ON trust_snapshots (user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_entity ON moderation_actions (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_admin ON moderation_actions (admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intel_pinned ON discord_intel_items (is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_intel_hold ON discord_intel_items (hold_until) WHERE hold_until IS NOT NULL;

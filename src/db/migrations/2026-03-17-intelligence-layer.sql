CREATE TABLE IF NOT EXISTS casino_health (
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

CREATE INDEX IF NOT EXISTS idx_casino_health_status ON casino_health(global_status);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES user_settings(user_id),
  push_warnings BOOLEAN DEFAULT TRUE,
  push_deals BOOLEAN DEFAULT TRUE,
  push_free_sc BOOLEAN DEFAULT TRUE,
  push_streak_reminders BOOLEAN DEFAULT FALSE,
  email_digest_frequency VARCHAR(20) DEFAULT 'none',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id INT NOT NULL REFERENCES discord_intel_items(id),
  user_id VARCHAR(255) NOT NULL REFERENCES user_settings(user_id),
  vote VARCHAR(12) NOT NULL CHECK (vote IN ('worked', 'didnt_work')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (signal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_signal_votes_signal ON signal_votes(signal_id);

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS layout_swap BOOLEAN DEFAULT FALSE;

ALTER TABLE user_settings
  ALTER COLUMN trust_score SET DEFAULT 0.50;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS contributor_tier VARCHAR(30) DEFAULT 'newcomer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_contributor_tier'
      AND conrelid = 'user_settings'::regclass
  ) THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT chk_contributor_tier
      CHECK (contributor_tier IN ('newcomer', 'scout', 'insider', 'operator'));
  END IF;
END $$;

ALTER TABLE discord_intel_items
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'discord',
  ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS worked_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS didnt_work_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signal_status TEXT DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_intel_source'
      AND conrelid = 'discord_intel_items'::regclass
  ) THEN
    ALTER TABLE discord_intel_items
      ADD CONSTRAINT chk_intel_source
      CHECK (source IN ('discord', 'admin', 'user'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_signal_status'
      AND conrelid = 'discord_intel_items'::regclass
  ) THEN
    ALTER TABLE discord_intel_items
      ADD CONSTRAINT chk_signal_status
      CHECK (signal_status IN ('active', 'conditional', 'likely_outdated', 'collapsed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_discord_intel_source ON discord_intel_items(source);

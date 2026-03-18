ALTER TABLE user_casino_settings ADD COLUMN IF NOT EXISTS no_daily_reward BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE casinos ADD COLUMN IF NOT EXISTS reset_mode VARCHAR(20) DEFAULT 'rolling';
ALTER TABLE casinos ADD COLUMN IF NOT EXISTS reset_interval_hours INT NOT NULL DEFAULT 24;
UPDATE casinos SET reset_mode = COALESCE(streak_mode, 'rolling') WHERE reset_mode IS NULL OR reset_mode = 'rolling';
ALTER TABLE casinos ADD CONSTRAINT chk_reset_mode CHECK (reset_mode IN ('rolling', 'fixed'));

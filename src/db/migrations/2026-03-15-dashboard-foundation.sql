ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS daily_goal_usd DECIMAL(10,2) DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS weekly_goal_usd DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS momentum_period TEXT DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS momentum_style JSONB,
  ADD COLUMN IF NOT EXISTS kpi_cards JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_settings_momentum_period_check'
      AND conrelid = 'user_settings'::regclass
  ) THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT user_settings_momentum_period_check
      CHECK (momentum_period IN ('daily', 'weekly'));
  END IF;
END $$;

ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'purchase';
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'free_sc';

ALTER TABLE ledger_entries
  ALTER COLUMN entry_at TYPE TIMESTAMPTZ
  USING (
    CASE
      WHEN entry_at IS NULL THEN NULL
      ELSE entry_at AT TIME ZONE 'UTC'
    END
  );

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS margin_pct DECIMAL(8,4),
  ADD COLUMN IF NOT EXISTS promo_code TEXT;

ALTER TABLE daily_bonus_claims
  ADD COLUMN IF NOT EXISTS reset_period_start TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_claims_period
  ON daily_bonus_claims(user_id, casino_id, reset_period_start)
  WHERE reset_period_start IS NOT NULL;

CREATE TABLE IF NOT EXISTS daily_aggregates (
  user_id TEXT NOT NULL REFERENCES user_settings(user_id),
  agg_date DATE NOT NULL,
  sc_earned DECIMAL(12,2) DEFAULT 0,
  usd_earned DECIMAL(10,2) DEFAULT 0,
  usd_spent DECIMAL(10,2) DEFAULT 0,
  purchase_count INT DEFAULT 0,
  claim_count INT DEFAULT 0,
  free_sc_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, agg_date)
);

UPDATE ledger_entries
SET entry_at = entry_date::timestamptz
WHERE entry_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_agg_recent
  ON daily_aggregates(user_id, agg_date DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_user_date
  ON ledger_entries(user_id, entry_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_user_casino_type
  ON ledger_entries(user_id, casino_id, entry_type);

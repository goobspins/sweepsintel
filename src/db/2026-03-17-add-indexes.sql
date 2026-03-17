-- Performance indexes for hot query paths

CREATE INDEX IF NOT EXISTS idx_user_casino_settings_user_active
ON user_casino_settings(user_id) WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_bonus_claims_user_casino_date
ON daily_bonus_claims(user_id, casino_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_casino
ON ledger_entries(user_id, casino_id);

CREATE INDEX IF NOT EXISTS idx_intel_items_casino_created
ON discord_intel_items(casino_id, created_at DESC)
WHERE casino_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signal_votes_item
ON signal_votes(signal_id);

-- Fix trust_snapshots column precision from DECIMAL(3,2) to NUMERIC(5,4).
-- DECIMAL(3,2) only stores 2 decimal places, which is too coarse for
-- sparkline charts and trust component breakdowns.
-- Existing rows (if any) are widened without data loss.

ALTER TABLE trust_snapshots
  ALTER COLUMN trust_score TYPE NUMERIC(5,4),
  ALTER COLUMN activity_score TYPE NUMERIC(5,4),
  ALTER COLUMN submission_score TYPE NUMERIC(5,4),
  ALTER COLUMN community_score TYPE NUMERIC(5,4),
  ALTER COLUMN portfolio_score TYPE NUMERIC(5,4);

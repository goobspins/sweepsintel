-- SweepsIntel Neon PostgreSQL Schema
-- Created: 2026-03-14
-- All tables use SERIAL for auto-incrementing IDs
-- Indexes created for common query patterns

-- 1. Casinos Table (Master casino data)
CREATE TABLE casinos (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  tier INT DEFAULT 2,
  rating DECIMAL(3,1),
  wash_games TEXT,
  pa_available BOOLEAN DEFAULT TRUE,
  ban_risk VARCHAR(50),
  redemption_speed VARCHAR(50),
  redemption_fee VARCHAR(100),
  crossing_available BOOLEAN DEFAULT FALSE,
  crossing_notes TEXT,
  playthrough_multiplier DECIMAL(3,1),
  platform VARCHAR(50),
  one_oh_nines_status VARCHAR(50),
  affiliate_link_url TEXT,
  affiliate_type VARCHAR(20),
  affiliate_enrollment_verified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  profile_content_md TEXT,
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_casinos_slug ON casinos(slug);
CREATE INDEX idx_casinos_tier ON casinos(tier);
CREATE INDEX idx_casinos_rating ON casinos(rating DESC);

-- 2. Daily Bonus Claims (User tracking)
CREATE TABLE daily_bonus_claims (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  casino_name VARCHAR(100),
  sc_amount DECIMAL(8,2),
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimed_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  is_affiliate_clicked BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, casino_id, claimed_date)
);

CREATE INDEX idx_daily_by_user_date ON daily_bonus_claims(user_id, claimed_date);
CREATE INDEX idx_daily_by_casino_date ON daily_bonus_claims(casino_id, claimed_date);

-- 3. P&L Ledger (Expense/earning tracking)
CREATE TABLE pl_ledger (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  casino_name VARCHAR(100),
  entry_type VARCHAR(20),
  amount DECIMAL(10,2),
  sc_amount DECIMAL(8,2),
  description TEXT,
  is_cross_wash BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recorded_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_pl_by_user_casino ON pl_ledger(user_id, casino_id, recorded_date);

-- 4. Ban Reports (Community UGC)
CREATE TABLE ban_reports (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  casino_name VARCHAR(100),
  issue_type VARCHAR(50),
  reporter_email VARCHAR(255),
  reporter_ip_hash VARCHAR(64),
  report_text TEXT NOT NULL,
  severity VARCHAR(20),
  is_flagged BOOLEAN DEFAULT FALSE,
  flagged_reason VARCHAR(255),
  is_published BOOLEAN DEFAULT FALSE,
  community_votes INT DEFAULT 0,
  report_submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  report_date DATE DEFAULT CURRENT_DATE,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP
);

CREATE INDEX idx_reports_by_casino ON ban_reports(casino_id, report_date);
CREATE INDEX idx_reports_published ON ban_reports(is_published, report_date DESC);
CREATE INDEX idx_reports_flagged ON ban_reports(is_flagged, report_date);
CREATE INDEX idx_reports_ip_hash ON ban_reports(reporter_ip_hash, report_date);

-- 5. Ban Uptick Alerts (Signal aggregation)
CREATE TABLE ban_uptick_alerts (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  issue_type VARCHAR(50),
  unique_reporters_7d INT,
  unique_reporters_24h INT,
  confidence_score DECIMAL(3,2),
  alert_message TEXT,
  was_broadcast BOOLEAN DEFAULT FALSE,
  broadcast_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Auth Sessions (Email OTP)
CREATE TABLE auth_sessions (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) UNIQUE NOT NULL,
  otp_token_hash VARCHAR(255),
  otp_expires_at TIMESTAMP,
  verified_at TIMESTAMP,
  session_token VARCHAR(255) UNIQUE,
  session_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_email ON auth_sessions(user_email);
CREATE INDEX idx_sessions_token ON auth_sessions(session_token);

-- 7. Click Tracking (Affiliate link clicks)
CREATE TABLE clicks (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  user_id VARCHAR(255),
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  clicked_date DATE DEFAULT CURRENT_DATE,
  referrer_source VARCHAR(100),
  user_agent VARCHAR(255)
);

CREATE INDEX idx_clicks_by_casino_date ON clicks(casino_id, clicked_date);
CREATE INDEX idx_clicks_by_user ON clicks(user_id);

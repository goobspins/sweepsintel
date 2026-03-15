CREATE TYPE state_avail_status AS ENUM (
  'available',
  'restricted',
  'legal_but_pulled_out',
  'operates_despite_restrictions'
);

CREATE TYPE redemption_status AS ENUM ('draft', 'pending', 'received', 'cancelled', 'rejected');
CREATE TYPE redemption_method AS ENUM ('ach', 'crypto', 'gift_card', 'other');

CREATE TYPE ledger_entry_type AS ENUM (
  'daily',
  'offer',
  'winnings',
  'wager',
  'adjustment',
  'redeem_confirmed'
);

CREATE TYPE notification_type AS ENUM (
  'state_pullout',
  'ban_uptick',
  'system'
);

CREATE TABLE casinos (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  tier VARCHAR(1) DEFAULT 'B',
  claim_url TEXT,
  reset_mode VARCHAR(20) DEFAULT 'rolling',
  reset_time_local VARCHAR(5),
  reset_timezone VARCHAR(50),
  reset_interval_hours INT NOT NULL DEFAULT 24,
  has_streaks BOOLEAN DEFAULT FALSE,
  sc_to_usd_ratio DECIMAL(6,4) DEFAULT 1.0,
  parent_company VARCHAR(100),
  promoban_risk VARCHAR(20) DEFAULT 'unknown',
  hardban_risk VARCHAR(20) DEFAULT 'unknown',
  family_ban_propagation BOOLEAN DEFAULT FALSE,
  ban_confiscates_funds BOOLEAN DEFAULT FALSE,
  daily_bonus_desc VARCHAR(100),
  daily_bonus_sc_avg INT,
  has_live_games BOOLEAN DEFAULT FALSE,
  redemption_speed_desc VARCHAR(100),
  redemption_fee_desc VARCHAR(100),
  min_redemption_usd DECIMAL(10,2),
  has_affiliate_link BOOLEAN DEFAULT FALSE,
  affiliate_link_url TEXT,
  affiliate_type VARCHAR(20),
  affiliate_enrollment_verified BOOLEAN DEFAULT FALSE,
  source VARCHAR(20) DEFAULT 'admin',
  is_excluded BOOLEAN DEFAULT FALSE,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE game_providers (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_live_game_provider BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE casino_live_game_providers (
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  provider_id INT REFERENCES game_providers(id) ON DELETE CASCADE,
  PRIMARY KEY (casino_id, provider_id)
);

CREATE TABLE state_legal_status (
  state_code CHAR(2) PRIMARY KEY,
  state_name VARCHAR(50) NOT NULL,
  sweepstakes_legal BOOLEAN NOT NULL,
  legal_notes TEXT,
  last_verified DATE,
  source_url TEXT
);

CREATE TABLE provider_state_availability (
  id SERIAL PRIMARY KEY,
  provider_id INT REFERENCES game_providers(id) ON DELETE CASCADE,
  state_code CHAR(2) REFERENCES state_legal_status(state_code),
  status state_avail_status NOT NULL DEFAULT 'available',
  notes TEXT,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_id, state_code)
);

CREATE TABLE casino_game_availability (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  provider_id INT REFERENCES game_providers(id),
  game_name VARCHAR(100) NOT NULL,
  game_type VARCHAR(50),
  is_cross_wash_relevant BOOLEAN DEFAULT FALSE,
  confidence VARCHAR(20) DEFAULT 'unverified',
  positive_signal_count INT DEFAULT 0,
  negative_signal_count INT DEFAULT 0,
  last_confirmed_at TIMESTAMP,
  last_negative_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(casino_id, game_name)
);

CREATE INDEX idx_game_avail_casino ON casino_game_availability(casino_id, status, is_cross_wash_relevant);
CREATE INDEX idx_game_avail_negative ON casino_game_availability(negative_signal_count) WHERE negative_signal_count >= 2;

CREATE TABLE game_volatility_reports (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  game_name VARCHAR(100) NOT NULL,
  provider_id INT REFERENCES game_providers(id),
  reported_volatility VARCHAR(20) NOT NULL,
  reported_rtp_pct DECIMAL(5,2),
  user_id VARCHAR(255) NOT NULL,
  trust_score_at_report DECIMAL(3,2) DEFAULT 1.0,
  notes TEXT,
  is_flagged BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_volatility_casino_game ON game_volatility_reports(casino_id, game_name, created_at DESC);

CREATE TABLE user_casino_settings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id) ON DELETE CASCADE,
  typical_daily_sc DECIMAL(8,2),
  personal_notes TEXT,
  sort_order INT,
  no_daily_reward BOOLEAN NOT NULL DEFAULT FALSE,
  added_at TIMESTAMP DEFAULT NOW(),
  removed_at TIMESTAMP,
  UNIQUE(user_id, casino_id)
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

CREATE TABLE state_availability_reports (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  provider_id INT REFERENCES game_providers(id),
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

CREATE TABLE state_pullout_alerts (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  provider_id INT REFERENCES game_providers(id),
  state_code CHAR(2),
  alert_message TEXT,
  was_broadcast BOOLEAN DEFAULT FALSE,
  broadcast_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_state_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  state_code CHAR(2) REFERENCES state_legal_status(state_code),
  UNIQUE(user_id, state_code)
);

CREATE TABLE reset_time_suggestions (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  suggested_reset_mode VARCHAR(20),
  suggested_reset_time VARCHAR(5),
  suggested_timezone VARCHAR(50),
  evidence_text TEXT,
  reporter_ip_hash VARCHAR(64),
  reporter_user_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  admin_notes TEXT,
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE daily_bonus_claims (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  claim_type VARCHAR(20) NOT NULL DEFAULT 'daily',
  sc_amount DECIMAL(8,2),
  notes TEXT,
  claimed_at TIMESTAMP DEFAULT NOW(),
  claimed_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, casino_id, claimed_date, claim_type)
);

CREATE TABLE redemptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  sc_amount DECIMAL(10,2) NOT NULL,
  usd_amount DECIMAL(10,2) NOT NULL,
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

CREATE TABLE user_settings (
  user_id VARCHAR(255) PRIMARY KEY,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  home_state CHAR(2),
  ledger_mode VARCHAR(20) DEFAULT 'simple',
  is_admin BOOLEAN DEFAULT FALSE,
  trust_score DECIMAL(3,2) DEFAULT 1.0,
  trust_score_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  notification_type notification_type NOT NULL,
  casino_id INT REFERENCES casinos(id),
  state_code CHAR(2),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON user_notifications(user_id, is_read, created_at DESC);

CREATE TABLE admin_flags (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  flag_type VARCHAR(50) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  state_code CHAR(2),
  flag_content TEXT NOT NULL,
  ai_summary TEXT,
  proposed_action TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  actioned_at TIMESTAMP,
  actioned_by VARCHAR(255)
);

CREATE INDEX idx_admin_flags_status ON admin_flags(status, created_at DESC);

CREATE TABLE ban_reports (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  report_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  reporter_ip_hash VARCHAR(64),
  reporter_user_id VARCHAR(255),
  is_flagged BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ban_reports_casino ON ban_reports(casino_id, is_published, submitted_at DESC);

CREATE TABLE ban_uptick_alerts (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  report_count INT NOT NULL,
  window_days INT DEFAULT 7,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE clicks (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  user_id VARCHAR(255),
  referrer_source VARCHAR(50),
  clicked_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_waitlist (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  source VARCHAR(50),
  captured_at TIMESTAMP DEFAULT NOW(),
  converted_user_id VARCHAR(255),
  converted_at TIMESTAMP
);

CREATE TABLE discord_intel_items (
  id SERIAL PRIMARY KEY,
  item_type VARCHAR(50) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  casino_name_raw VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64),
  source_channel VARCHAR(100),
  is_published BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,
  confidence VARCHAR(20) DEFAULT 'unverified',
  confidence_reason TEXT,
  auto_published BOOLEAN DEFAULT FALSE,
  confirm_count INT DEFAULT 0,
  dispute_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

CREATE INDEX idx_discord_intel_published ON discord_intel_items(is_published, expires_at, created_at DESC);

CREATE TABLE discord_intel_reactions (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES discord_intel_items(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  reaction VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(item_id, user_id)
);

CREATE TABLE admin_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  subscription_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_ucs_user_active ON user_casino_settings(user_id) WHERE removed_at IS NULL;
CREATE INDEX idx_discord_intel_casino_published ON discord_intel_items(casino_id, is_published, created_at DESC) WHERE is_published = true;
CREATE INDEX idx_push_subs_user_active ON push_subscriptions(user_id) WHERE is_active = true;
CREATE INDEX idx_ledger_user_casino_exists ON ledger_entries(user_id, casino_id);
CREATE INDEX idx_casinos_tier ON casinos(tier);
CREATE INDEX idx_ban_reports_pending ON ban_reports(id) WHERE is_published = false;
CREATE INDEX idx_state_reports_pending ON state_availability_reports(id) WHERE is_published = false;
CREATE INDEX idx_reset_suggestions_pending ON reset_time_suggestions(id) WHERE status = 'pending';
CREATE INDEX idx_admin_flags_pending ON admin_flags(id) WHERE status = 'pending';
CREATE INDEX idx_casinos_user_suggested ON casinos(id) WHERE source = 'user_suggested';

INSERT INTO admin_settings (key, value, updated_at)
VALUES
  ('auto_publish_enabled', 'false', NOW()),
  ('auto_publish_delay_minutes', '120', NOW());

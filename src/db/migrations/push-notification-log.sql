CREATE TABLE IF NOT EXISTS push_notification_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  payload_title VARCHAR(255),
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_log_user_day
  ON push_notification_log(user_id, sent_at DESC);

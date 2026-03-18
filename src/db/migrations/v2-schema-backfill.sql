UPDATE discord_intel_items
SET signal_priority = CASE
  WHEN item_type = 'platform_warning' THEN 'critical'
  WHEN item_type IN ('flash_sale', 'promo_code') THEN 'high'
  WHEN item_type IN ('free_sc', 'playthrough_deal') THEN 'normal'
  WHEN item_type = 'general_tip' THEN 'low'
  ELSE 'normal'
END
WHERE signal_priority = 'normal' OR signal_priority IS NULL;

UPDATE discord_intel_items
SET first_reporter_id = submitted_by
WHERE submitted_by IS NOT NULL
  AND is_anonymous = false
  AND first_reporter_id IS NULL;

UPDATE casino_health
SET effective_status = CASE
  WHEN admin_override_status IS NOT NULL THEN admin_override_status::health_status
  WHEN global_status = 'healthy' THEN 'healthy'::health_status
  WHEN global_status = 'watch' THEN 'watch'::health_status
  WHEN global_status = 'at_risk' THEN 'at_risk'::health_status
  WHEN global_status = 'critical' THEN 'critical'::health_status
  ELSE 'healthy'::health_status
END;

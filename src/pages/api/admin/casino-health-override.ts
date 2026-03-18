import type { APIRoute } from 'astro';

import { query } from '../../../lib/db';
import { withRoute } from '../../../lib/route';

export const prerender = false;

export const POST: APIRoute = withRoute(async (ctx) => {
  const body = ctx.body;
  const casinoId = Number(body?.casino_id);
  const status =
    body?.status === null || body?.status === undefined || body?.status === ''
      ? null
      : String(body.status);
  const reason =
    typeof body?.reason === 'string' && body.reason.trim().length > 0
      ? body.reason.trim()
      : null;

  if (!Number.isFinite(casinoId)) {
    return { _status: 400, error: 'Casino id is required.' };
  }

  if (status !== null && !['healthy', 'watch', 'at_risk', 'critical'].includes(status)) {
    return { _status: 400, error: 'Invalid health status.' };
  }

  await query(
    `INSERT INTO casino_health (casino_id, global_status, admin_override_status, admin_override_reason, admin_override_at)
    VALUES ($1, 'healthy', $2, $3, CASE WHEN $2 IS NULL THEN NULL ELSE NOW() END)
    ON CONFLICT (casino_id)
    DO UPDATE SET
      admin_override_status = EXCLUDED.admin_override_status,
      admin_override_reason = EXCLUDED.admin_override_reason,
      admin_override_at = CASE WHEN EXCLUDED.admin_override_status IS NULL THEN NULL ELSE NOW() END`,
    [casinoId, status, reason],
  );

  return { success: true };
}, { auth: 'admin' });

import type { APIRoute } from 'astro';

import { isHttpError, requireAdmin } from '../../../lib/auth';
import { query } from '../../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const body = await request.json();
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
      return json({ error: 'Casino id is required.' }, 400);
    }

    if (status !== null && !['healthy', 'watch', 'at_risk', 'critical'].includes(status)) {
      return json({ error: 'Invalid health status.' }, 400);
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

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/casino-health-override failed', error);
    return json({ error: 'Unable to save health override.' }, 500);
  }
};

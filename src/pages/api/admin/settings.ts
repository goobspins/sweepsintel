import type { APIRoute } from 'astro';

import { isHttpError, requireAdmin } from '../../../lib/auth';
import { query } from '../../../lib/db';

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
    const enabled = body?.auto_publish_enabled ? 'true' : 'false';
    const delay = String(body?.auto_publish_delay_minutes ?? '120');

    await query(
      `INSERT INTO admin_settings (key, value, updated_at)
      VALUES ('auto_publish_enabled', $1, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [enabled],
    );
    await query(
      `INSERT INTO admin_settings (key, value, updated_at)
      VALUES ('auto_publish_delay_minutes', $1, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [delay],
    );

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/settings failed', error);
    return json({ error: 'Unable to save admin settings.' }, 500);
  }
};

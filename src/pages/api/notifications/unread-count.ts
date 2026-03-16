import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const rows = await query<{ count: number | string }>(
      `SELECT COUNT(*)::int AS count
      FROM user_notifications
      WHERE user_id = $1
        AND is_read = false`,
      [user.userId],
    );

    return json({ count: Number(rows[0]?.count ?? 0) });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }

    console.error('notifications/unread-count failed', error);
    return json({ error: 'Unable to load unread count.' }, 500);
  }
};


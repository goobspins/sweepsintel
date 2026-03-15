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

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'mark_all') {
      await query(
        `UPDATE user_notifications
        SET is_read = true
        WHERE user_id = $1
          AND is_read = false`,
        [user.userId],
      );
    } else if (action === 'mark_one') {
      const notificationId = Number(body?.notification_id);
      if (!Number.isFinite(notificationId)) {
        return json({ error: 'notification_id is required.' }, 400);
      }

      await query(
        `UPDATE user_notifications
        SET is_read = true
        WHERE id = $1
          AND user_id = $2`,
        [notificationId, user.userId],
      );
    } else {
      return json({ error: 'Invalid action.' }, 400);
    }

    const unreadRows = await query<{ count: number | string }>(
      `SELECT COUNT(*)::int AS count
      FROM user_notifications
      WHERE user_id = $1
        AND is_read = false`,
      [user.userId],
    );

    return json({
      success: true,
      unread_count: Number(unreadRows[0]?.count ?? 0),
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }

    console.error('notifications/mark-read failed', error);
    return json({ error: 'Unable to update notifications.' }, 500);
  }
};

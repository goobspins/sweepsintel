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

    const [notifications, unreadRows] = await Promise.all([
      query<{
        id: number;
        notification_type: 'state_pullout' | 'ban_uptick' | 'system';
        casino_id: number | null;
        state_code: string | null;
        title: string;
        message: string;
        action_url: string | null;
        is_read: boolean;
        created_at: string;
      }>(
        `SELECT
          id,
          notification_type,
          casino_id,
          state_code,
          title,
          message,
          action_url,
          is_read,
          created_at
        FROM user_notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
        [user.userId],
      ),
      query<{ count: number | string }>(
        `SELECT COUNT(*)::int AS count
        FROM user_notifications
        WHERE user_id = $1
          AND is_read = false`,
        [user.userId],
      ),
    ]);

    return json({
      notifications,
      unread_count: Number(unreadRows[0]?.count ?? 0),
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }

    console.error('notifications/list failed', error);
    return json({ error: 'Unable to load notifications.' }, 500);
  }
};


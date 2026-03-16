import type { APIRoute } from 'astro';

import { query } from '../../../lib/db';
import { sendPushToUser } from '../../../lib/push';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hasCronAccess(request: Request) {
  const expected = import.meta.env.CRON_SECRET;
  if (!expected) {
    return false;
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token === expected;
}

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!hasCronAccess(request)) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  try {
    const users = await query<{ user_id: string }>(
      `SELECT DISTINCT ps.user_id
      FROM push_subscriptions ps
      WHERE ps.is_active = true
        AND ps.user_id NOT IN (
          SELECT user_id
          FROM push_notification_log
          WHERE payload_title = 'Daily Reset Reminder'
            AND sent_at > CURRENT_DATE
        )`,
    );

    let notified = 0;
    let skipped = 0;

    for (const user of users) {
      const activeSession = await query<{ id: number }>(
        `SELECT 1 AS id
        FROM auth_sessions
        WHERE user_id = $1
          AND last_active_at > NOW() - INTERVAL '2 hours'
        LIMIT 1`,
        [user.user_id],
      );

      if (activeSession.length > 0) {
        skipped += 1;
        continue;
      }

      const unclaimed = await query<{ id: number }>(
        `SELECT 1 AS id
        FROM user_casino_settings ucs
        JOIN casinos c ON c.id = ucs.casino_id
        LEFT JOIN daily_bonus_claims dbc
          ON dbc.user_id = ucs.user_id
          AND dbc.casino_id = ucs.casino_id
          AND dbc.claimed_date = CURRENT_DATE
        WHERE ucs.user_id = $1
          AND ucs.removed_at IS NULL
          AND dbc.id IS NULL
        LIMIT 1`,
        [user.user_id],
      );

      if (unclaimed.length === 0) {
        skipped += 1;
        continue;
      }

      const sent = await sendPushToUser(user.user_id, {
        title: 'Daily Reset Reminder',
        body: 'Your casinos are ready to claim.',
        url: '/tracker',
      });

      if (sent > 0) {
        notified += 1;
      } else {
        skipped += 1;
      }
    }

    return json({ notified, skipped });
  } catch (error) {
    console.error('cron/push-resets failed', error);
    return json({ error: 'Unable to send reset reminders.' }, 500);
  }
};


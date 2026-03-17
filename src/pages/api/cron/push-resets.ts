import type { APIRoute } from 'astro';
import { DateTime } from 'luxon';

import { isHttpError } from '../../../lib/auth';
import { query } from '../../../lib/db';
import { sendPushToUser } from '../../../lib/push';
import { computeFixedResetPeriodStart } from '../../../lib/reset';

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

function isClaimAvailable(row: {
  no_daily_reward: boolean;
  reset_mode: string | null;
  reset_time_local: string | null;
  reset_timezone: string | null;
  reset_interval_hours: number | null;
  last_claimed_at: string | null;
}) {
  if (row.no_daily_reward) {
    return false;
  }

  const intervalHours =
    typeof row.reset_interval_hours === 'number' && row.reset_interval_hours > 0
      ? row.reset_interval_hours
      : 24;
  const now = DateTime.now().toUTC();

  if (row.reset_mode === 'fixed') {
    const currentPeriodStart = computeFixedResetPeriodStart(
      {
        reset_time_local: row.reset_time_local,
        reset_timezone: row.reset_timezone,
        reset_interval_hours: intervalHours,
      },
      now,
    );

    if (!currentPeriodStart) {
      return false;
    }

    if (!row.last_claimed_at) {
      return true;
    }

    const lastClaim = DateTime.fromISO(row.last_claimed_at).toUTC();
    if (!lastClaim.isValid) {
      return false;
    }

    return lastClaim < currentPeriodStart.toUTC();
  }

  if (!row.last_claimed_at) {
    return true;
  }

  const lastClaim = DateTime.fromISO(row.last_claimed_at).toUTC();
  if (!lastClaim.isValid) {
    return false;
  }

  return lastClaim.plus({ hours: intervalHours }) <= now;
}

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

      const trackerRows = await query<{
        no_daily_reward: boolean;
        reset_mode: string | null;
        reset_time_local: string | null;
        reset_timezone: string | null;
        reset_interval_hours: number | null;
        last_claimed_at: string | null;
      }>(
        `SELECT
          ucs.no_daily_reward,
          c.reset_mode,
          c.reset_time_local,
          c.reset_timezone,
          c.reset_interval_hours,
          dbc.claimed_at AS last_claimed_at
        FROM user_casino_settings ucs
        JOIN casinos c ON c.id = ucs.casino_id
        LEFT JOIN LATERAL (
          SELECT claimed_at
          FROM daily_bonus_claims
          WHERE user_id = ucs.user_id
            AND casino_id = ucs.casino_id
            AND claim_type = 'daily'
          ORDER BY claimed_at DESC
          LIMIT 1
        ) dbc ON true
        WHERE ucs.user_id = $1
          AND ucs.removed_at IS NULL`,
        [user.user_id],
      );

      const hasAvailableClaim = trackerRows.some((row) => isClaimAvailable(row));
      if (!hasAvailableClaim) {
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
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('[api/cron/push-resets]', error);
    return json({ error: 'Unable to send reset reminders.' }, 500);
  }
};


import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../../lib/auth';
import { query } from '../../../../lib/db';

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

    const casinoId = Number(body?.casino_id);
    const noDailyReward = Boolean(body?.no_daily_reward);

    if (!Number.isFinite(casinoId)) {
      return json({ error: 'Casino is required.' }, 400);
    }

    const rows = await query<{
      casino_id: number;
      no_daily_reward: boolean;
    }>(
      `UPDATE user_casino_settings
      SET no_daily_reward = $3
      WHERE user_id = $1
        AND casino_id = $2
        AND removed_at IS NULL
      RETURNING casino_id, no_daily_reward`,
      [user.userId, casinoId, noDailyReward],
    );

    if (rows.length === 0) {
      return json({ error: 'Tracked casino not found.' }, 404);
    }

    return json({
      success: true,
      casino_id: rows[0].casino_id,
      no_daily_reward: rows[0].no_daily_reward,
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('tracker/casino-settings failed', error);
    return json({ error: 'Unable to save casino settings.' }, 500);
  }
};


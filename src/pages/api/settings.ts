import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../lib/auth';
import { getCached } from '../../lib/cache';
import { query, transaction } from '../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadSettings(userId: string) {
  const [settingsRows, subscriptionRows, states] = await Promise.all([
    query<{
      timezone: string | null;
      home_state: string | null;
      ledger_mode: 'simple' | 'advanced' | null;
      daily_goal_usd: number | string | null;
      weekly_goal_usd: number | string | null;
    }>(
      `SELECT timezone, home_state, ledger_mode, daily_goal_usd, weekly_goal_usd
      FROM user_settings
      WHERE user_id = $1
      LIMIT 1`,
      [userId],
    ),
    query<{ state_code: string }>(
      `SELECT state_code
      FROM user_state_subscriptions
      WHERE user_id = $1
      ORDER BY state_code ASC`,
      [userId],
    ),
    getCached('settings:states', 30 * 60 * 1000, async () =>
      query<{ state_code: string; state_name: string }>(
        `SELECT state_code, state_name
        FROM state_legal_status
        ORDER BY state_name ASC`,
      )),
  ]);

  const settings = settingsRows[0] ?? {
    timezone: 'America/New_York',
    home_state: null,
    ledger_mode: 'simple' as const,
    daily_goal_usd: 5,
    weekly_goal_usd: null,
  };

  return {
    timezone: settings.timezone ?? 'America/New_York',
    home_state: settings.home_state,
    ledger_mode: settings.ledger_mode ?? 'simple',
    daily_goal_usd:
      settings.daily_goal_usd === null ? 5 : Number(settings.daily_goal_usd) || 5,
    weekly_goal_usd:
      settings.weekly_goal_usd === null ? null : Number(settings.weekly_goal_usd) || null,
    state_subscriptions: subscriptionRows.map((row) => row.state_code),
    states,
  };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    return json(await loadSettings(user.userId));
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('settings GET failed', error);
    return json({ error: 'Unable to load settings.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const timezone =
      typeof body?.timezone === 'string' && body.timezone.trim()
        ? body.timezone.trim()
        : null;
    const homeState =
      typeof body?.home_state === 'string' && body.home_state.trim()
        ? body.home_state.trim().toUpperCase()
        : null;
    const ledgerMode =
      body?.ledger_mode === 'simple' || body?.ledger_mode === 'advanced'
        ? body.ledger_mode
        : null;
    const stateSubscriptions = Array.isArray(body?.state_subscriptions)
      ? Array.from(
          new Set(
            body.state_subscriptions
              .map((value: unknown) => String(value).toUpperCase())
              .filter((value: string) => /^[A-Z]{2}$/.test(value)),
          ),
        )
      : null;
    const dailyGoalUsd =
      body?.daily_goal_usd === null || body?.daily_goal_usd === undefined || body?.daily_goal_usd === ''
        ? null
        : Number(body.daily_goal_usd);
    const weeklyGoalUsd =
      body?.weekly_goal_usd === null || body?.weekly_goal_usd === undefined || body?.weekly_goal_usd === ''
        ? null
        : Number(body.weekly_goal_usd);

    await transaction(async (tx) => {
      await tx.query(
        `UPDATE user_settings
        SET timezone = COALESCE($2, timezone),
            home_state = COALESCE($3, home_state),
            ledger_mode = COALESCE($4, ledger_mode),
            daily_goal_usd = COALESCE($5, daily_goal_usd),
            weekly_goal_usd = $6,
            updated_at = NOW()
        WHERE user_id = $1`,
        [
          user.userId,
          timezone,
          homeState,
          ledgerMode,
          Number.isFinite(dailyGoalUsd) && dailyGoalUsd !== null ? dailyGoalUsd : null,
          Number.isFinite(weeklyGoalUsd) ? weeklyGoalUsd : null,
        ],
      );

      if (stateSubscriptions) {
        await tx.query(
          `DELETE FROM user_state_subscriptions
          WHERE user_id = $1`,
          [user.userId],
        );

        for (const stateCode of stateSubscriptions) {
          await tx.query(
            `INSERT INTO user_state_subscriptions (user_id, state_code)
            VALUES ($1, $2)`,
            [user.userId, stateCode],
          );
        }
      }
    });

    return json(await loadSettings(user.userId));
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('settings POST failed', error);
    return json({ error: 'Unable to save settings.' }, 500);
  }
};


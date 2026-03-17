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
      kpi_cards: unknown;
      momentum_style: unknown;
      layout_swap: boolean | null;
    }>(
      `SELECT timezone, home_state, ledger_mode, daily_goal_usd, weekly_goal_usd, kpi_cards, momentum_style, layout_swap
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
    kpi_cards: null,
    momentum_style: null,
    layout_swap: false,
  };

  return {
    timezone: settings.timezone ?? 'America/New_York',
    home_state: settings.home_state,
    ledger_mode: settings.ledger_mode ?? 'simple',
    daily_goal_usd:
      settings.daily_goal_usd === null ? 5 : Number(settings.daily_goal_usd) || 5,
    weekly_goal_usd:
      settings.weekly_goal_usd === null ? null : Number(settings.weekly_goal_usd) || null,
    kpi_cards: normalizeKpiCards(settings.kpi_cards),
    momentum_style: normalizeMomentumStyle(settings.momentum_style),
    layout_swap: Boolean(settings.layout_swap),
    state_subscriptions: subscriptionRows.map((row) => row.state_code),
    states,
  };
}

function normalizeKpiCards(value: unknown) {
  const parsed = parseJsonish(value);
  const allowed = new Set([
    'sc_earned',
    'usd_earned',
    'purchases',
    'pending_redemptions',
    'best_performer',
    'claim_streak',
    'daily_velocity',
  ]);
  if (!Array.isArray(parsed)) {
    return ['sc_earned', 'usd_earned', 'purchases', 'pending_redemptions'];
  }

  const filtered = parsed.filter(
    (item): item is string => typeof item === 'string' && allowed.has(item),
  );
  return filtered.length >= 3 ? filtered.slice(0, 4) : ['sc_earned', 'usd_earned', 'purchases', 'pending_redemptions'];
}

function normalizeMomentumStyle(value: unknown) {
  const parsed = parseJsonish(value);
  const allowed = new Set(['rainbow', 'green', 'blue', 'amber', 'purple']);
  return typeof parsed === 'string' && allowed.has(parsed) ? parsed : 'rainbow';
}

function parseJsonish(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(body ?? {}, key);

    const timezone =
      typeof body?.timezone === 'string' && body.timezone.trim()
        ? body.timezone.trim()
        : null;
    const hasHomeState = hasOwn('home_state');
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
    const dailyGoalUsd = !hasOwn('daily_goal_usd')
      ? undefined
      : body?.daily_goal_usd === null || body?.daily_goal_usd === ''
        ? null
        : Number(body.daily_goal_usd);
    const weeklyGoalUsd = !hasOwn('weekly_goal_usd')
      ? undefined
      : body?.weekly_goal_usd === null || body?.weekly_goal_usd === ''
        ? null
        : Number(body.weekly_goal_usd);
    const kpiCards = Array.isArray(body?.kpi_cards)
      ? body.kpi_cards.filter(
          (value: unknown): value is string =>
            typeof value === 'string' &&
            ['sc_earned', 'usd_earned', 'purchases', 'pending_redemptions', 'best_performer', 'claim_streak', 'daily_velocity'].includes(value),
        )
      : undefined;
    const momentumStyle =
      typeof body?.momentum_style === 'string' &&
      ['rainbow', 'green', 'blue', 'amber', 'purple'].includes(body.momentum_style)
        ? body.momentum_style
        : undefined;
    const layoutSwap =
      !hasOwn('layout_swap') ? undefined : Boolean(body?.layout_swap);

    await transaction(async (tx) => {
      await tx.query(
        `UPDATE user_settings
        SET timezone = COALESCE($2, timezone),
            home_state = CASE WHEN $3::boolean THEN $4 ELSE home_state END,
            ledger_mode = COALESCE($5, ledger_mode),
            daily_goal_usd = COALESCE($6, daily_goal_usd),
            weekly_goal_usd = CASE WHEN $7::boolean THEN $8 ELSE weekly_goal_usd END,
            kpi_cards = COALESCE($9::jsonb, kpi_cards),
            momentum_style = COALESCE($10::jsonb, momentum_style),
            layout_swap = CASE WHEN $11::boolean THEN $12 ELSE layout_swap END,
            updated_at = NOW()
        WHERE user_id = $1`,
        [
          user.userId,
          timezone,
          hasHomeState,
          homeState,
          ledgerMode,
          dailyGoalUsd === undefined
            ? null
            : Number.isFinite(dailyGoalUsd) && dailyGoalUsd !== null
              ? dailyGoalUsd
              : null,
          weeklyGoalUsd !== undefined,
          weeklyGoalUsd === undefined
            ? null
            : Number.isFinite(weeklyGoalUsd)
              ? weeklyGoalUsd
              : null,
          kpiCards && kpiCards.length >= 3 && kpiCards.length <= 4 ? JSON.stringify(kpiCards) : null,
          momentumStyle ? JSON.stringify(momentumStyle) : null,
          layoutSwap !== undefined,
          layoutSwap ?? false,
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


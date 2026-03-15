import type { APIRoute } from 'astro';

import { createAdminFlag } from '../../../lib/admin';
import { isHttpError, requireAdmin } from '../../../lib/auth';
import { methodNotAllowed } from '../../../lib/api';
import { query, transaction } from '../../../lib/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type CasinoPayload = Record<string, unknown>;

function pickField(body: CasinoPayload, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key) ? body[key] : undefined;
}

async function syncProviders(casinoId: number, providers: number[]) {
  await transaction(async (tx) => {
    await tx.query('DELETE FROM casino_live_game_providers WHERE casino_id = $1', [casinoId]);
    for (const providerId of providers) {
      await tx.query(
        `INSERT INTO casino_live_game_providers (casino_id, provider_id)
        VALUES ($1, $2)`,
        [casinoId, providerId],
      );
    }
  });
}

async function syncGames(casinoId: number, games: Array<Record<string, unknown>>) {
  for (const game of games) {
    const gameId = typeof game.id === 'number' ? game.id : null;
    if (gameId) {
      await query(
        `UPDATE casino_game_availability
        SET provider_id = $1,
            game_name = $2,
            game_type = $3,
            is_cross_wash_relevant = $4,
            confidence = $5,
            status = $6,
            updated_at = NOW()
        WHERE id = $7 AND casino_id = $8`,
        [
          game.provider_id ?? null,
          game.game_name ?? '',
          game.game_type ?? null,
          Boolean(game.is_cross_wash_relevant),
          game.confidence ?? 'unverified',
          game.status ?? 'available',
          gameId,
          casinoId,
        ],
      );
      continue;
    }

    if (!game.game_name) {
      continue;
    }

    await query(
      `INSERT INTO casino_game_availability (
        casino_id,
        provider_id,
        game_name,
        game_type,
        is_cross_wash_relevant,
        confidence,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (casino_id, game_name)
      DO UPDATE SET
        provider_id = EXCLUDED.provider_id,
        game_type = EXCLUDED.game_type,
        is_cross_wash_relevant = EXCLUDED.is_cross_wash_relevant,
        confidence = EXCLUDED.confidence,
        status = EXCLUDED.status,
        updated_at = NOW()`,
      [
        casinoId,
        game.provider_id ?? null,
        game.game_name,
        game.game_type ?? null,
        Boolean(game.is_cross_wash_relevant),
        game.confidence ?? 'unverified',
        game.status ?? 'available',
      ],
    );
  }
}

export const GET: APIRoute = async () => methodNotAllowed(['PATCH', 'POST']);

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as CasinoPayload;
    const providers = Array.isArray(body.providers)
      ? body.providers.map(Number).filter(Number.isFinite)
      : [];
    const games = Array.isArray(body.games)
      ? (body.games as Array<Record<string, unknown>>)
      : [];

    const created = await query<{ id: number }>(
      `INSERT INTO casinos (
        slug,
        name,
        tier,
        claim_url,
        reset_mode,
        reset_time_local,
        reset_timezone,
        reset_interval_hours,
        has_streaks,
        sc_to_usd_ratio,
        parent_company,
        promoban_risk,
        hardban_risk,
        family_ban_propagation,
        ban_confiscates_funds,
        daily_bonus_desc,
        daily_bonus_sc_avg,
        has_live_games,
        redemption_speed_desc,
        redemption_fee_desc,
        min_redemption_usd,
        has_affiliate_link,
        affiliate_link_url,
        affiliate_type,
        affiliate_enrollment_verified,
        source,
        is_excluded,
        last_updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,NOW()
      )
      RETURNING id`,
      [
        body.slug,
        body.name,
        body.tier ?? 'B',
        body.claim_url ?? null,
        body.reset_mode ?? 'rolling',
        body.reset_time_local ?? null,
        body.reset_timezone ?? null,
        body.reset_interval_hours ?? 24,
        Boolean(body.has_streaks),
        body.sc_to_usd_ratio ?? 1,
        body.parent_company ?? null,
        body.promoban_risk ?? 'unknown',
        body.hardban_risk ?? 'unknown',
        Boolean(body.family_ban_propagation),
        Boolean(body.ban_confiscates_funds),
        body.daily_bonus_desc ?? null,
        body.daily_bonus_sc_avg ?? null,
        Boolean(body.has_live_games),
        body.redemption_speed_desc ?? null,
        body.redemption_fee_desc ?? null,
        body.min_redemption_usd ?? null,
        Boolean(body.has_affiliate_link),
        body.affiliate_link_url ?? null,
        body.affiliate_type ?? null,
        Boolean(body.affiliate_enrollment_verified),
        body.source ?? 'admin',
        Boolean(body.is_excluded),
      ],
    );

    const casinoId = created[0].id;
    if (providers.length > 0) {
      await syncProviders(casinoId, providers);
    }
    if (games.length > 0) {
      await syncGames(casinoId, games);
    }

    return json({ success: true, id: casinoId });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/casinos POST failed', error);
    return json({ error: 'Unable to create casino.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const admin = await requireAdmin(request);
    const body = (await request.json()) as CasinoPayload;
    const casinoId = Number(body.id);
    if (!Number.isFinite(casinoId)) {
      return json({ error: 'Casino id is required.' }, 400);
    }

    const providers = Array.isArray(body.providers)
      ? body.providers.map(Number).filter(Number.isFinite)
      : null;
    const games = Array.isArray(body.games)
      ? (body.games as Array<Record<string, unknown>>)
      : null;
    const shouldFlag = Boolean(body.flag_for_review);

    const allowed = [
      'slug',
      'name',
      'tier',
      'claim_url',
      'reset_mode',
      'reset_time_local',
      'reset_timezone',
      'reset_interval_hours',
      'has_streaks',
      'sc_to_usd_ratio',
      'parent_company',
      'promoban_risk',
      'hardban_risk',
      'family_ban_propagation',
      'ban_confiscates_funds',
      'daily_bonus_desc',
      'daily_bonus_sc_avg',
      'has_live_games',
      'redemption_speed_desc',
      'redemption_fee_desc',
      'min_redemption_usd',
      'has_affiliate_link',
      'affiliate_link_url',
      'affiliate_type',
      'affiliate_enrollment_verified',
      'source',
      'is_excluded',
    ];

    const updates: string[] = [];
    const params: unknown[] = [];

    for (const key of allowed) {
      const value = pickField(body, key);
      if (value !== undefined) {
        params.push(value);
        updates.push(`${key} = $${params.length}`);
      }
    }

    params.push(casinoId);
    if (updates.length > 0) {
      await query(
        `UPDATE casinos
        SET ${updates.join(', ')},
            last_updated_at = NOW()
        WHERE id = $${params.length}`,
        params,
      );
    }

    if (providers) {
      await syncProviders(casinoId, providers);
    }
    if (games) {
      await syncGames(casinoId, games);
    }
    if (shouldFlag) {
      await createAdminFlag({
        source: 'manual',
        flagType: 'data_anomaly',
        casinoId,
        flagContent: `Manual review requested for casino ${casinoId}.`,
        proposedAction: `Flagged by ${admin.userId}`,
      });
    }

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/casinos PATCH failed', error);
    return json({ error: 'Unable to update casino.' }, 500);
  }
};

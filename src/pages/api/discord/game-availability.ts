import type { APIRoute } from 'astro';

import { createAdminFlag } from '../../../lib/admin';
import {
  requireDiscordIngestKey,
  resolveCasinoBySlug,
  resolveProviderBySlug,
  type GameAvailabilitySignal,
} from '../../../lib/discord-intel';
import { query } from '../../../lib/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!requireDiscordIngestKey(request)) {
      return json({ error: 'Unauthorized.' }, 401);
    }

    const body = (await request.json()) as GameAvailabilitySignal[];
    if (!Array.isArray(body)) {
      return json({ error: 'Payload must be an array.' }, 400);
    }

    let processed = 0;

    for (const signal of body) {
      const casino = await resolveCasinoBySlug(signal.casino_slug);
      if (!casino) {
        continue;
      }

      const provider = await resolveProviderBySlug(signal.provider_slug);
      const row = await query<{
        id: number;
        positive_signal_count: number;
        negative_signal_count: number;
        status: string;
      }>(
        `INSERT INTO casino_game_availability (
          casino_id,
          provider_id,
          game_name,
          game_type,
          is_cross_wash_relevant,
          positive_signal_count,
          negative_signal_count,
          last_confirmed_at,
          last_negative_at,
          status
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7,
          CASE WHEN $8 = 'positive' THEN NOW() ELSE NULL END,
          CASE WHEN $8 = 'negative' THEN NOW() ELSE NULL END,
          'available'
        )
        ON CONFLICT (casino_id, game_name)
        DO UPDATE SET
          provider_id = COALESCE(EXCLUDED.provider_id, casino_game_availability.provider_id),
          game_type = COALESCE(EXCLUDED.game_type, casino_game_availability.game_type),
          is_cross_wash_relevant = EXCLUDED.is_cross_wash_relevant OR casino_game_availability.is_cross_wash_relevant,
          positive_signal_count = casino_game_availability.positive_signal_count + CASE WHEN $8 = 'positive' THEN 1 ELSE 0 END,
          negative_signal_count = CASE
            WHEN $8 = 'positive' AND casino_game_availability.status = 'removed' THEN 0
            ELSE casino_game_availability.negative_signal_count + CASE WHEN $8 = 'negative' THEN 1 ELSE 0 END
          END,
          last_confirmed_at = CASE WHEN $8 = 'positive' THEN NOW() ELSE casino_game_availability.last_confirmed_at END,
          last_negative_at = CASE WHEN $8 = 'negative' THEN NOW() ELSE casino_game_availability.last_negative_at END,
          status = CASE
            WHEN $8 = 'positive' AND casino_game_availability.status = 'removed' THEN 'unconfirmed'
            ELSE casino_game_availability.status
          END,
          updated_at = NOW()
        RETURNING id, positive_signal_count, negative_signal_count, status`,
        [
          casino.id,
          provider?.id ?? null,
          signal.game_name,
          signal.game_type ?? null,
          Boolean(signal.is_cross_wash_relevant),
          signal.signal_type === 'positive' ? 1 : 0,
          signal.signal_type === 'negative' ? 1 : 0,
          signal.signal_type,
        ],
      );

      const updated = row[0];
      const confidence =
        updated.positive_signal_count >= 3 && updated.negative_signal_count === 0
          ? 'high'
          : updated.positive_signal_count >= 1 && updated.negative_signal_count === 0
            ? 'medium'
            : updated.positive_signal_count >= 1 && updated.negative_signal_count >= 1
              ? 'low'
              : 'unverified';

      await query(
        `UPDATE casino_game_availability
        SET confidence = $1
        WHERE id = $2`,
        [confidence, updated.id],
      );

      if (updated.negative_signal_count >= 2) {
        await createAdminFlag({
          source: 'discord_feed',
          flagType: 'game_availability_change',
          casinoId: casino.id,
          flagContent: `${signal.game_name} may no longer be available at ${casino.name}.`,
          aiSummary: `${signal.game_name} may no longer be available at ${casino.name}.`,
          proposedAction: 'Verify and update status to removed or dismiss.',
        });
      }

      processed += 1;
    }

    return json({ success: true, processed });
  } catch (error) {
    console.error('discord/game-availability failed', error);
    return json({ error: 'Unable to process game availability signals.' }, 500);
  }
};

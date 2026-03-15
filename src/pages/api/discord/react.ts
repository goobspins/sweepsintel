import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { transaction } from '../../../lib/db';

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

    const itemId = Number(body?.item_id);
    const reaction =
      body?.reaction === 'confirm' || body?.reaction === 'dispute'
        ? body.reaction
        : null;

    if (!Number.isFinite(itemId) || !reaction) {
      return json({ error: 'Item and reaction are required.' }, 400);
    }

    const result = await transaction(async (tx) => {
      await tx.query(
        `INSERT INTO discord_intel_reactions (item_id, user_id, reaction)
        VALUES ($1, $2, $3)
        ON CONFLICT (item_id, user_id)
        DO UPDATE SET reaction = EXCLUDED.reaction, created_at = NOW()`,
        [itemId, user.userId, reaction],
      );

      const updatedRows = await tx.query<{
        confirm_count: number;
        dispute_count: number;
      }>(
        `UPDATE discord_intel_items
        SET
          confirm_count = (
            SELECT COUNT(*)
            FROM discord_intel_reactions
            WHERE item_id = $1 AND reaction = 'confirm'
          ),
          dispute_count = (
            SELECT COUNT(*)
            FROM discord_intel_reactions
            WHERE item_id = $1 AND reaction = 'dispute'
          )
        WHERE id = $1
        RETURNING confirm_count, dispute_count`,
        [itemId],
      );

      return updatedRows[0];
    });

    return json({ success: true, ...result });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('discord/react failed', error);
    return json({ error: 'Unable to save reaction.' }, 500);
  }
};



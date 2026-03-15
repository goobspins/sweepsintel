import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { transaction, query } from '../../../lib/db';
import { invalidateCached } from '../../../lib/cache';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_ACTIONS = new Set(['received', 'cancelled', 'rejected']);

export const GET: APIRoute = async () => methodNotAllowed(['POST']);

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const redemptionId = Number(body?.redemption_id);
    const action = typeof body?.action === 'string' ? body.action : '';

    if (!Number.isFinite(redemptionId)) {
      return json({ error: 'Redemption is required.' }, 400);
    }
    if (!VALID_ACTIONS.has(action)) {
      return json({ error: 'Invalid status action.' }, 400);
    }

    const existing = await query<{ id: number; status: string }>(
      `SELECT id, status
      FROM redemptions
      WHERE id = $1 AND user_id = $2
      LIMIT 1`,
      [redemptionId, user.userId],
    );

    if (existing.length === 0) {
      return json({ error: 'Redemption not found.' }, 404);
    }
    if (existing[0].status !== 'pending') {
      return json({ error: 'Only pending redemptions can be updated.' }, 409);
    }

    if (action === 'received') {
      const result = await transaction(async (tx) => {
        const updatedRows = await tx.query<{
          id: number;
          user_id: string;
          casino_id: number;
          sc_amount: string;
          usd_amount: string;
          fees_usd: string;
          is_crypto: boolean;
          status: string;
          confirmed_at: string;
        }>(
          `UPDATE redemptions
          SET status = 'received',
              confirmed_at = NOW()
          WHERE id = $1
            AND user_id = $2
            AND status = 'pending'
          RETURNING
            id,
            user_id,
            casino_id,
            sc_amount,
            usd_amount,
            fees_usd,
            is_crypto,
            status,
            confirmed_at`,
          [redemptionId, user.userId],
        );

        const updated = updatedRows[0];
        if (!updated) {
          throw new Error('Redemption update failed.');
        }

        const netUsd = Number(updated.usd_amount) - Number(updated.fees_usd ?? 0);
        const scAmount = Number(updated.sc_amount);

        await tx.query(
          `INSERT INTO ledger_entries (
            user_id,
            casino_id,
            entry_type,
            usd_amount,
            sc_amount,
            source_redemption_id,
            is_crypto
          ) VALUES ($1, $2, 'redeem_confirmed', $3, $4, $5, $6)`,
          [updated.user_id, updated.casino_id, netUsd, -Math.abs(scAmount), updated.id, updated.is_crypto],
        );

        return updated;
      });

      invalidateCached(`ledger-summary:${user.userId}`);
      return json({ success: true, redemption: result });
    }

    const statusSql = action === 'cancelled'
      ? `UPDATE redemptions
        SET status = 'cancelled',
            cancelled_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND status = 'pending'
        RETURNING id, status, cancelled_at`
      : `UPDATE redemptions
        SET status = 'rejected'
        WHERE id = $1
          AND user_id = $2
          AND status = 'pending'
        RETURNING id, status`;

    const rows = await query(statusSql, [redemptionId, user.userId]);
    if (rows.length === 0) {
      return json({ error: 'Unable to update redemption.' }, 409);
    }

    return json({ success: true, redemption: rows[0] });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('redemptions/update-status failed', error);
    return json({ error: 'Unable to update redemption.' }, 500);
  }
};



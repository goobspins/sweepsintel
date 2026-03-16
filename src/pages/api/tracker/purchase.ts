import type { APIRoute } from 'astro';

import { invalidateCached } from '../../../lib/cache';
import { isHttpError, requireAuth } from '../../../lib/auth';
import { query, transaction } from '../../../lib/db';

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
    const costUsd = Number(body?.cost_usd);
    const scAmount = Number(body?.sc_amount);
    const promoCode =
      typeof body?.promo_code === 'string' && body.promo_code.trim().length > 0
        ? body.promo_code.trim()
        : null;
    const notes =
      typeof body?.notes === 'string' && body.notes.trim().length > 0
        ? body.notes.trim()
        : null;

    if (!Number.isFinite(casinoId)) {
      return json({ error: 'Casino is required.' }, 400);
    }

    if (!Number.isFinite(costUsd) || costUsd <= 0) {
      return json({ error: 'Cost must be a positive number.' }, 400);
    }

    if (!Number.isFinite(scAmount) || scAmount <= 0) {
      return json({ error: 'SC received must be a positive number.' }, 400);
    }

    const casinoRows = await query<{ id: number; sc_to_usd_ratio: number | string | null }>(
      `SELECT id, sc_to_usd_ratio
      FROM casinos
      WHERE id = $1
      LIMIT 1`,
      [casinoId],
    );
    const casino = casinoRows[0];
    if (!casino) {
      return json({ error: 'Casino not found.' }, 404);
    }

    const ratio = Number(casino.sc_to_usd_ratio ?? 1);
    const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
    const impliedUsd = scAmount * safeRatio;
    const marginPct = costUsd > 0 ? (impliedUsd - costUsd) / costUsd : null;

    const entry = await transaction(async (tx) => {
      const purchaseRows = await tx.query<{
        id: number;
        casino_id: number;
        entry_type: string;
        sc_amount: number | string | null;
        usd_amount: number | string | null;
        promo_code: string | null;
        notes: string | null;
        margin_pct: number | string | null;
        entry_at: string;
      }>(
        `INSERT INTO ledger_entries (
          user_id,
          casino_id,
          entry_type,
          sc_amount,
          usd_amount,
          promo_code,
          notes,
          margin_pct
        ) VALUES ($1, $2, 'purchase', $3, $4, $5, $6, $7)
        RETURNING id, casino_id, entry_type, sc_amount, usd_amount, promo_code, notes, margin_pct, entry_at`,
        [user.userId, casinoId, scAmount, -costUsd, promoCode, notes, marginPct],
      );

      const purchaseEntry = purchaseRows[0];

      const creditRows = await tx.query<{ id: number }>(
        `INSERT INTO ledger_entries (
          user_id,
          casino_id,
          entry_type,
          sc_amount,
          usd_amount,
          notes,
          linked_entry_id
        ) VALUES ($1, $2, 'purchase_credit', $3, 0, 'SC from purchase', $4)
        RETURNING id`,
        [user.userId, casinoId, scAmount, purchaseEntry.id],
      );

      await tx.query(
        `UPDATE ledger_entries
        SET linked_entry_id = $2
        WHERE id = $1`,
        [purchaseEntry.id, creditRows[0].id],
      );

      return {
        ...purchaseEntry,
        linked_entry_id: creditRows[0].id,
      };
    });

    invalidateCached(`ledger-summary:${user.userId}`);
    return json({ success: true, entry }, 201);
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('tracker/purchase failed', error);
    return json({ error: 'Unable to save purchase.' }, 500);
  }
};

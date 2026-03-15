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

    const casinoId = Number(body?.casino_id);
    const claimType =
      typeof body?.claim_type === 'string' && body.claim_type.trim().length > 0
        ? body.claim_type.trim()
        : 'daily';
    const scAmount =
      body?.sc_amount === null || body?.sc_amount === undefined || body?.sc_amount === ''
        ? null
        : Number(body.sc_amount);

    if (!Number.isFinite(casinoId)) {
      return json({ error: 'Casino is required.' }, 400);
    }

    if (scAmount !== null && !Number.isFinite(scAmount)) {
      return json({ error: 'SC amount must be numeric.' }, 400);
    }

    const result = await transaction(async (tx) => {
      const existing = await tx.query<{ id: number }>(
        `SELECT id
        FROM daily_bonus_claims
        WHERE user_id = $1
          AND casino_id = $2
          AND claimed_date = CURRENT_DATE
          AND claim_type = $3
        LIMIT 1`,
        [user.userId, casinoId, claimType],
      );

      if (existing.length > 0) {
        return { duplicate: true as const, claimId: existing[0].id };
      }

      const claimRows = await tx.query<{ id: number; claimed_at: string }>(
        `INSERT INTO daily_bonus_claims (
          user_id,
          casino_id,
          claim_type,
          sc_amount
        ) VALUES ($1, $2, $3, $4)
        RETURNING id, claimed_at`,
        [user.userId, casinoId, claimType, scAmount],
      );

      const claim = claimRows[0];

      await tx.query(
        `INSERT INTO ledger_entries (
          user_id,
          casino_id,
          entry_type,
          sc_amount,
          usd_amount,
          source_claim_id
        ) VALUES ($1, $2, 'daily', $3, 0, $4)`,
        [user.userId, casinoId, scAmount, claim.id],
      );

      return {
        duplicate: false as const,
        claimId: claim.id,
        claimedAt: claim.claimed_at,
      };
    });

    if (result.duplicate) {
      return json({ error: 'You already claimed this casino today.' }, 409);
    }

    return json({
      success: true,
      claim_id: result.claimId,
      claimed_at: result.claimedAt,
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('tracker/claim failed', error);
    return json({ error: 'Unable to save claim.' }, 500);
  }
};



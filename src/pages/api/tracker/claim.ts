import type { APIRoute } from 'astro';
import { DateTime } from 'luxon';

import { invalidateCached } from '../../../lib/cache';
import { isHttpError, requireAuth } from '../../../lib/auth';
import { transaction } from '../../../lib/db';
import { computeFixedResetPeriodStart } from '../../../lib/reset';

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
      const casinoRows = await tx.query<{
        id: number;
        reset_mode: string | null;
        reset_time_local: string | null;
        reset_timezone: string | null;
        reset_interval_hours: number | null;
      }>(
        `SELECT
          id,
          reset_mode,
          reset_time_local,
          reset_timezone,
          reset_interval_hours
        FROM casinos
        WHERE id = $1
        LIMIT 1`,
        [casinoId],
      );

      const casino = casinoRows[0];
      if (!casino) {
        return { missingCasino: true as const };
      }

      const lastClaimRows = await tx.query<{
        id: number;
        claimed_at: string;
        reset_period_start: string | null;
      }>(
        `SELECT id, claimed_at, reset_period_start
        FROM daily_bonus_claims
        WHERE user_id = $1
          AND casino_id = $2
          AND claim_type = $3
        ORDER BY claimed_at DESC
        LIMIT 1`,
        [user.userId, casinoId, claimType],
      );

      const intervalHours =
        typeof casino.reset_interval_hours === 'number' && casino.reset_interval_hours > 0
          ? casino.reset_interval_hours
          : 24;
      const now = DateTime.now().toUTC();

      let resetPeriodStart: string | null = null;

      if (casino.reset_mode === 'fixed') {
        const fixedStart = computeFixedResetPeriodStart(
          {
            reset_time_local: casino.reset_time_local,
            reset_timezone: casino.reset_timezone,
            reset_interval_hours: intervalHours,
          },
          now,
        );

        if (!fixedStart) {
          return { invalidResetConfig: true as const };
        }

        resetPeriodStart = fixedStart.toUTC().toISO();
      } else {
        const lastClaim = lastClaimRows[0];
        if (!lastClaim) {
          resetPeriodStart = now.toISO();
        } else {
          const lastClaimAt = DateTime.fromISO(lastClaim.claimed_at).toUTC();
          const previousPeriodStart = lastClaim.reset_period_start
            ? DateTime.fromISO(lastClaim.reset_period_start).toUTC()
            : lastClaimAt;
          const nextPeriodStart = lastClaimAt.plus({ hours: intervalHours });
          const currentPeriodStart = now < nextPeriodStart ? previousPeriodStart : nextPeriodStart;
          resetPeriodStart = currentPeriodStart.toISO();
        }
      }

      const existing = await tx.query<{ id: number }>(
        `SELECT id
        FROM daily_bonus_claims
        WHERE user_id = $1
          AND casino_id = $2
          AND reset_period_start = $3
          AND claim_type = $4
        LIMIT 1`,
        [user.userId, casinoId, resetPeriodStart, claimType],
      );

      if (existing.length > 0) {
        return { duplicate: true as const, claimId: existing[0].id };
      }

      const claimRows = await tx.query<{ id: number; claimed_at: string }>(
        `INSERT INTO daily_bonus_claims (
          user_id,
          casino_id,
          claim_type,
          sc_amount,
          reset_period_start,
          claimed_date
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
        RETURNING id, claimed_at`,
        [user.userId, casinoId, claimType, scAmount, resetPeriodStart],
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

    if ('missingCasino' in result) {
      return json({ error: 'Casino not found.' }, 404);
    }

    if ('invalidResetConfig' in result) {
      return json({ error: 'Casino reset configuration is invalid.' }, 400);
    }

    if (result.duplicate) {
      return json({ error: 'You already claimed this reset period.' }, 409);
    }

    invalidateCached(`ledger-summary:${user.userId}`);

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



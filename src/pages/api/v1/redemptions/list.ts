import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../../lib/auth';
import { query } from '../../../../lib/db';
import { getRedemptionStatsForCasinos } from '../../../../lib/redemption-stats';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);

    const redemptions = await query<{
      id: number;
      casino_id: number;
      casino_name: string;
      slug: string;
      sc_to_usd_ratio: string | null;
      sc_amount: string;
      usd_amount: string;
      fees_usd: string;
      method: string;
      is_crypto: boolean;
      bank_note: string | null;
      status: string;
      notes: string | null;
      submitted_at: string;
      confirmed_at: string | null;
      cancelled_at: string | null;
    }>(
      `SELECT
        r.id,
        r.casino_id,
        c.name AS casino_name,
        c.slug,
        c.sc_to_usd_ratio,
        r.sc_amount,
        r.usd_amount,
        r.fees_usd,
        r.method,
        r.is_crypto,
        r.bank_note,
        r.status,
        r.notes,
        r.submitted_at,
        r.confirmed_at,
        r.cancelled_at
      FROM redemptions r
      JOIN casinos c ON c.id = r.casino_id
      WHERE r.user_id = $1
      ORDER BY r.submitted_at DESC`,
      [user.userId],
    );

    const statsMap = await getRedemptionStatsForCasinos(
      redemptions.map((redemption) => redemption.casino_id),
    );

    const hydrated = redemptions.map((redemption) => {
      const stats = statsMap.get(redemption.casino_id);
      return {
        ...redemption,
        sc_amount: Number(redemption.sc_amount),
        usd_amount: Number(redemption.usd_amount),
        fees_usd: Number(redemption.fees_usd ?? 0),
        sc_to_usd_ratio: redemption.sc_to_usd_ratio === null ? null : Number(redemption.sc_to_usd_ratio),
        average_days: stats?.medianDays ?? null,
        p80_days: stats?.p80Days ?? null,
        trend_warning: stats?.trendWarning ?? false,
        sample_count: stats?.sampleCount ?? 0,
      };
    });

    const pending = hydrated.filter((row) => row.status === 'pending');
    const inTransitTotalUsd = pending.reduce((sum, row) => sum + row.usd_amount, 0);

    return json({
      redemptions: hydrated,
      in_transit_total_usd: inTransitTotalUsd,
      pending_count: pending.length,
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('redemptions/list failed', error);
    return json({ error: 'Unable to load redemptions.' }, 500);
  }
};


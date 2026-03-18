import type { APIRoute } from 'astro';

import { getCached } from '../../../../lib/cache';
import { isHttpError, requireAuth } from '../../../../lib/auth';
import { query } from '../../../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const LEDGER_SUMMARY_TTL_MS = 5 * 60 * 1000;

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);

    const data = await getCached(`ledger-summary:${user.userId}`, LEDGER_SUMMARY_TTL_MS, async () => {
      const rows = await query<{
        casino_id: number;
        casino_name: string;
        net_usd: string | null;
        net_sc: string | null;
        pending_redemption_sc: string | null;
      }>(
        `SELECT
          le.casino_id,
          c.name AS casino_name,
          SUM(le.usd_amount) AS net_usd,
          SUM(CASE WHEN le.entry_type IN ('daily', 'free_sc', 'purchase_credit') THEN COALESCE(le.sc_amount, 0) ELSE 0 END) AS net_sc,
          COALESCE(r.pending_redemption_sc, 0) AS pending_redemption_sc
        FROM ledger_entries le
        JOIN casinos c ON c.id = le.casino_id
        LEFT JOIN (
          SELECT casino_id, SUM(sc_amount) AS pending_redemption_sc
          FROM redemptions
          WHERE user_id = $1
            AND status = 'pending'
          GROUP BY casino_id
        ) r ON r.casino_id = le.casino_id
        WHERE le.user_id = $1
        GROUP BY le.casino_id, c.name, r.pending_redemption_sc
        ORDER BY c.name ASC`,
        [user.userId],
      );

      const breakdown = rows.map((row) => ({
        casino_id: row.casino_id,
        casino_name: row.casino_name,
        net_usd: Number(row.net_usd ?? 0),
        net_sc: Number(row.net_sc ?? 0),
        available_sc: Number(row.net_sc ?? 0) - Number(row.pending_redemption_sc ?? 0),
      }));

      return {
        total_in_usd: breakdown.reduce((sum, row) => sum + Math.max(row.net_usd, 0), 0),
        total_out_usd: breakdown.reduce((sum, row) => sum + Math.abs(Math.min(row.net_usd, 0)), 0),
        net_pl_usd: breakdown.reduce((sum, row) => sum + row.net_usd, 0),
        breakdown,
      };
    });

    return json(data);
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('ledger/summary failed', error);
    return json({ error: 'Unable to load ledger summary.' }, 500);
  }
};


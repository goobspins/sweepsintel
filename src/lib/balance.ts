import { query } from './db';

export interface BalanceBreakdownRow {
  casino_id: number;
  casino_name: string;
  available_sc: number;
}

export async function getAvailableSc(userId: string, casinoId: number): Promise<number> {
  const rows = await query<{ available_sc: number | string | null }>(
    `SELECT
      COALESCE((
        SELECT SUM(sc_amount)
        FROM ledger_entries
        WHERE user_id = $1
          AND casino_id = $2
          AND entry_type IN ('daily', 'free_sc', 'purchase_credit')
      ), 0) - COALESCE((
        SELECT SUM(sc_amount)
        FROM redemptions
        WHERE user_id = $1
          AND casino_id = $2
          AND status = 'pending'
      ), 0) AS available_sc`,
    [userId, casinoId],
  );

  return Number(rows[0]?.available_sc ?? 0);
}

export async function getBalanceBreakdown(userId: string): Promise<BalanceBreakdownRow[]> {
  const rows = await query<{
    casino_id: number;
    casino_name: string;
    available_sc: number | string | null;
  }>(
    `SELECT
      c.id AS casino_id,
      c.name AS casino_name,
      COALESCE(le.net_sc, 0) - COALESCE(r.pending_sc, 0) AS available_sc
    FROM casinos c
    JOIN (
      SELECT casino_id
      FROM user_casino_settings
      WHERE user_id = $1
      GROUP BY casino_id
    ) tracked ON tracked.casino_id = c.id
    LEFT JOIN (
      SELECT casino_id, SUM(sc_amount) AS net_sc
      FROM ledger_entries
      WHERE user_id = $1
        AND entry_type IN ('daily', 'free_sc', 'purchase_credit')
      GROUP BY casino_id
    ) le ON le.casino_id = c.id
    LEFT JOIN (
      SELECT casino_id, SUM(sc_amount) AS pending_sc
      FROM redemptions
      WHERE user_id = $1
        AND status = 'pending'
      GROUP BY casino_id
    ) r ON r.casino_id = c.id
    ORDER BY c.name ASC`,
    [userId],
  );

  return rows.map((row) => ({
    casino_id: row.casino_id,
    casino_name: row.casino_name,
    available_sc: Number(row.available_sc ?? 0),
  }));
}


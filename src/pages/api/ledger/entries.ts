import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

export const prerender = false;

interface LedgerEntryRow {
  id: number;
  casino_id: number;
  casino_name: string;
  entry_type: string;
  sc_amount: number | string | null;
  usd_amount: number | string | null;
  is_crypto: boolean | null;
  notes: string | null;
  source_redemption_id: number | null;
  source_claim_id: number | null;
  linked_entry_id: number | null;
  link_id: string | null;
  entry_at: string | null;
  entry_date: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const user = await requireAuth(request);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const casinoId = url.searchParams.get('casino_id');
    const entryType = url.searchParams.get('entry_type');
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');

    const where: string[] = ['le.user_id = $1'];
    const params: Array<string | number> = [user.userId];

    if (casinoId && Number.isFinite(Number(casinoId))) {
      params.push(Number(casinoId));
      where.push(`le.casino_id = $${params.length}`);
    }
    if (entryType) {
      params.push(entryType);
      where.push(`le.entry_type = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      where.push(`le.entry_date >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      where.push(`le.entry_date <= $${params.length}`);
    }

    params.push(20);
    params.push((page - 1) * 20);

    const rows = await query<LedgerEntryRow>(
      `SELECT
        le.id,
        le.casino_id,
        c.name AS casino_name,
        le.entry_type,
        le.sc_amount,
        le.usd_amount,
        le.is_crypto,
        le.notes,
        le.source_redemption_id,
        le.source_claim_id,
        le.linked_entry_id,
        le.link_id,
        le.entry_at,
        le.entry_date
      FROM ledger_entries le
      JOIN casinos c ON c.id = le.casino_id
      WHERE ${where.join(' AND ')}
      ORDER BY le.entry_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return json({
      entries: rows.map((row) => ({
        ...row,
        sc_amount: row.sc_amount === null ? null : Number(row.sc_amount),
        usd_amount: row.usd_amount === null ? null : Number(row.usd_amount),
      })),
      page,
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('ledger/entries failed', error);
    return json({ error: 'Unable to load ledger entries.' }, 500);
  }
};


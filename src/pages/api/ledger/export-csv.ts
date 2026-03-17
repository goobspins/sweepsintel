import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);

    const rows = await query<{
      entry_date: string;
      casino_name: string;
      entry_type: string;
      sc_amount: string | null;
      usd_amount: string | null;
      notes: string | null;
    }>(
      `SELECT
        le.entry_date,
        c.name AS casino_name,
        le.entry_type,
        le.sc_amount,
        le.usd_amount,
        le.notes
      FROM ledger_entries le
      JOIN casinos c ON c.id = le.casino_id
      WHERE le.user_id = $1
      ORDER BY le.entry_at DESC`,
      [user.userId],
    );

    const csv = [
      ['Date', 'Casino', 'Type', 'SC Amount', 'USD Amount', 'Notes'].join(','),
      ...rows.map((row) => [
        escapeCsv(row.entry_date),
        escapeCsv(row.casino_name),
        escapeCsv(row.entry_type),
        escapeCsv(row.sc_amount),
        escapeCsv(row.usd_amount),
        escapeCsv(row.notes),
      ].join(',')),
    ].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ledger-export.csv"',
      },
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('[api/ledger/export-csv]', error);
    return json({ error: 'Unable to export ledger CSV.' }, 500);
  }
};


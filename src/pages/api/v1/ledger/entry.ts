import type { APIRoute } from 'astro';

import { invalidateCached } from '../../../../lib/cache';
import { isHttpError, requireAuth } from '../../../../lib/auth';
import { query } from '../../../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_ENTRY_TYPES = new Set([
  'daily',
  'offer',
  'winnings',
  'wager',
  'adjustment',
  'redeem_confirmed',
]);

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const casinoId = Number(body?.casino_id);
    const entryType = typeof body?.entry_type === 'string' ? body.entry_type : '';
    const scAmount = body?.sc_amount === undefined || body?.sc_amount === null || body?.sc_amount === ''
      ? null
      : Number(body.sc_amount);
    const usdAmount = body?.usd_amount === undefined || body?.usd_amount === null || body?.usd_amount === ''
      ? null
      : Number(body.usd_amount);
    const isCrypto = Boolean(body?.is_crypto);
    const notes = typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
    const linkId = typeof body?.link_id === 'string' && body.link_id.trim() ? body.link_id.trim() : null;

    if (!Number.isFinite(casinoId)) {
      return json({ error: 'Casino is required.' }, 400);
    }
    if (!VALID_ENTRY_TYPES.has(entryType)) {
      return json({ error: 'Invalid ledger entry type.' }, 400);
    }
    if (entryType === 'redeem_confirmed') {
      return json({ error: 'redeem_confirmed entries are system-generated only.' }, 400);
    }
    if (scAmount !== null && !Number.isFinite(scAmount)) {
      return json({ error: 'SC amount must be numeric.' }, 400);
    }
    if (usdAmount !== null && !Number.isFinite(usdAmount)) {
      return json({ error: 'USD amount must be numeric.' }, 400);
    }

    const casino = await query<{ id: number }>('SELECT id FROM casinos WHERE id = $1 LIMIT 1', [casinoId]);
    if (casino.length === 0) {
      return json({ error: 'Casino not found.' }, 404);
    }

    const rows = await query(
      `INSERT INTO ledger_entries (
        user_id,
        casino_id,
        entry_type,
        sc_amount,
        usd_amount,
        is_crypto,
        notes,
        link_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, casino_id, entry_type, sc_amount, usd_amount, is_crypto, notes, link_id, entry_at`,
      [user.userId, casinoId, entryType, scAmount, usdAmount, isCrypto, notes, linkId],
    );

    invalidateCached(`ledger-summary:${user.userId}`);
    return json({ success: true, entry: rows[0] }, 201);
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('ledger/entry failed', error);
    return json({ error: 'Unable to save ledger entry.' }, 500);
  }
};




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

const VALID_METHODS = new Set(['ach', 'crypto', 'gift_card', 'other']);

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const casinoId = Number(body?.casino_id);
    const scAmount = Number(body?.sc_amount);
    const usdAmount = Number(body?.usd_amount);
    const feesUsd = body?.fees_usd === undefined || body?.fees_usd === null || body?.fees_usd === ''
      ? 0
      : Number(body.fees_usd);
    const method = typeof body?.method === 'string' ? body.method : 'ach';
    const bankNote = typeof body?.bank_note === 'string' && body.bank_note.trim()
      ? body.bank_note.trim()
      : null;
    const notes = typeof body?.notes === 'string' && body.notes.trim()
      ? body.notes.trim()
      : null;

    if (!Number.isFinite(casinoId)) {
      return json({ error: 'Casino is required.' }, 400);
    }
    if (!Number.isFinite(scAmount) || scAmount <= 0) {
      return json({ error: 'SC amount must be greater than zero.' }, 400);
    }
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
      return json({ error: 'USD amount must be greater than zero.' }, 400);
    }
    if (!Number.isFinite(feesUsd) || feesUsd < 0) {
      return json({ error: 'Fees must be zero or greater.' }, 400);
    }
    if (!VALID_METHODS.has(method)) {
      return json({ error: 'Invalid redemption method.' }, 400);
    }

    const casino = await query<{ id: number }>(
      'SELECT id FROM casinos WHERE id = $1 LIMIT 1',
      [casinoId],
    );
    if (casino.length === 0) {
      return json({ error: 'Casino not found.' }, 404);
    }

    const rows = await query<{
      id: number;
      user_id: string;
      casino_id: number;
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
      `INSERT INTO redemptions (
        user_id,
        casino_id,
        sc_amount,
        usd_amount,
        fees_usd,
        method,
        is_crypto,
        bank_note,
        status,
        notes,
        submitted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, NOW())
      RETURNING
        id,
        user_id,
        casino_id,
        sc_amount,
        usd_amount,
        fees_usd,
        method,
        is_crypto,
        bank_note,
        status,
        notes,
        submitted_at,
        confirmed_at,
        cancelled_at`,
      [user.userId, casinoId, scAmount, usdAmount, feesUsd, method, method === 'crypto', bankNote, notes],
    );

    return json({ success: true, redemption: rows[0] }, 201);
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('redemptions/submit failed', error);
    return json({ error: 'Unable to submit redemption.' }, 500);
  }
};




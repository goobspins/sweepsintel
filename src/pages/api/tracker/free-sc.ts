import type { APIRoute } from 'astro';

import { invalidateCached } from '../../../lib/cache';
import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

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
    const scAmount = Number(body?.sc_amount);
    const notes =
      typeof body?.notes === 'string' && body.notes.trim().length > 0
        ? body.notes.trim()
        : null;

    if (!Number.isFinite(casinoId)) {
      return json({ error: 'Casino is required.' }, 400);
    }

    if (!Number.isFinite(scAmount) || scAmount <= 0) {
      return json({ error: 'SC amount is required.' }, 400);
    }

    const casino = await query<{ id: number }>(
      'SELECT id FROM casinos WHERE id = $1 LIMIT 1',
      [casinoId],
    );
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
        notes
      ) VALUES ($1, $2, 'free_sc', $3, 0, $4)
      RETURNING id, casino_id, entry_type, sc_amount, usd_amount, notes, entry_at`,
      [user.userId, casinoId, scAmount, notes],
    );

    invalidateCached(`ledger-summary:${user.userId}`);
    return json({ success: true, entry: rows[0] }, 201);
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('tracker/free-sc failed', error);
    return json({ error: 'Unable to save free spins.' }, 500);
  }
};

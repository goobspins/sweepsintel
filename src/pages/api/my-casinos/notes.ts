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

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const casinoId = Number(body?.casino_id);
    if (!Number.isInteger(casinoId) || casinoId <= 0) {
      return json({ error: 'Valid casino_id is required.' }, 400);
    }

    const notes =
      typeof body?.notes === 'string' && body.notes.trim().length > 0
        ? body.notes.trim().slice(0, 4000)
        : null;

    const rows = await query<{ notes: string | null }>(
      `UPDATE user_casino_settings
      SET notes = $3
      WHERE user_id = $1
        AND casino_id = $2
        AND removed_at IS NULL
      RETURNING notes`,
      [user.userId, casinoId, notes],
    );

    if (rows.length === 0) {
      return json({ error: 'Tracked casino not found.' }, 404);
    }

    return json({ notes: rows[0].notes ?? '' });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('my-casinos/notes failed', error);
    return json({ error: 'Unable to save notes.' }, 500);
  }
};

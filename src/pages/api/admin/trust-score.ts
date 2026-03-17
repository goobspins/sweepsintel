import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import { isHttpError, requireAdmin } from '../../../lib/auth';
import { query } from '../../../lib/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async () => methodNotAllowed(['POST']);

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const userId = String(body?.user_id ?? '').trim();
    const trustScore = Number(body?.trust_score);

    if (!userId || !Number.isFinite(trustScore)) {
      return json({ error: 'User and trust score are required.' }, 400);
    }

    await query(
      `UPDATE user_settings
      SET trust_score = $1,
          trust_score_updated_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $2`,
      [trustScore, userId],
    );

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/trust-score failed', error);
    return json({ error: 'Unable to update trust score.' }, 500);
  }
};




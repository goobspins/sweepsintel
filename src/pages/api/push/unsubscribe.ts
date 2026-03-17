import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const prerender = false;

export const GET: APIRoute = async () => methodNotAllowed(['POST']);



export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);

    await query(
      `UPDATE push_subscriptions
      SET is_active = false
      WHERE user_id = $1`,
      [user.userId],
    );

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('push/unsubscribe failed', error);
    return json({ error: 'Unable to disable push notifications.' }, 500);
  }
};




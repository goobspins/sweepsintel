import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const subscription = body?.subscription;

    if (
      !subscription ||
      typeof subscription.endpoint !== 'string' ||
      !subscription.keys ||
      typeof subscription.keys.p256dh !== 'string' ||
      typeof subscription.keys.auth !== 'string'
    ) {
      return json({ error: 'A valid push subscription is required.' }, 400);
    }

    const encoded = JSON.stringify(subscription);

    await query(
      `UPDATE push_subscriptions
      SET is_active = true,
          subscription_json = $2
      WHERE user_id = $1
        AND subscription_json::jsonb->>'endpoint' = $3`,
      [user.userId, encoded, subscription.endpoint],
    );

    const existing = await query<{ id: number }>(
      `SELECT id
      FROM push_subscriptions
      WHERE user_id = $1
        AND subscription_json::jsonb->>'endpoint' = $2
      LIMIT 1`,
      [user.userId, subscription.endpoint],
    );

    if (existing.length === 0) {
      await query(
        `INSERT INTO push_subscriptions (user_id, subscription_json, is_active)
        VALUES ($1, $2, true)`,
        [user.userId, encoded],
      );
    }

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('push/subscribe failed', error);
    return json({ error: 'Unable to save push subscription.' }, 500);
  }
};

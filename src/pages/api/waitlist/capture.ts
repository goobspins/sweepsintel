import type { APIRoute } from 'astro';

import { isHttpError, isValidEmail, normalizeEmail } from '../../../lib/auth';
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
    const body = await request.json();
    const email = normalizeEmail(String(body?.email ?? ''));
    const source = String(body?.source ?? 'unknown');

    if (!isValidEmail(email)) {
      return json({ error: 'Enter a valid email address.' }, 400);
    }

    const existing = await query<{ id: number }>(
      'SELECT id FROM email_waitlist WHERE email = $1 LIMIT 1',
      [email],
    );

    if (existing.length > 0) {
      return json({ error: 'Already subscribed' });
    }

    await query(
      `INSERT INTO email_waitlist (email, source)
      VALUES ($1, $2)`,
      [email, source],
    );

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('[api/waitlist/capture]', error);
    return json({ error: 'Unable to subscribe right now.' }, 500);
  }
};




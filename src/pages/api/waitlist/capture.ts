import type { APIRoute } from 'astro';

import { isValidEmail, normalizeEmail } from '../../../lib/auth';
import { query } from '../../../lib/db';
import { withRoute } from '../../../lib/route';

export const prerender = false;

export const POST: APIRoute = withRoute(async (ctx) => {
  const email = normalizeEmail(String(ctx.body?.email ?? ''));
  const source = String(ctx.body?.source ?? 'unknown');

  if (!isValidEmail(email)) {
    return { _status: 400, error: 'Enter a valid email address.' };
  }

  const existing = await query<{ id: number }>(
    'SELECT id FROM email_waitlist WHERE email = $1 LIMIT 1',
    [email],
  );

  if (existing.length > 0) {
    return { error: 'Already subscribed' };
  }

  await query(
    `INSERT INTO email_waitlist (email, source)
    VALUES ($1, $2)`,
    [email, source],
  );

  return { success: true };
}, { auth: 'public' });




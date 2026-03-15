import type { APIRoute } from 'astro';

import {
  getSessionCookieOptions,
  getSessionCookieValue,
  hashToken,
  SESSION_COOKIE_NAME,
} from '../../../lib/auth';
import { query } from '../../../lib/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const sessionToken = getSessionCookieValue(request);

    if (sessionToken) {
      await query('DELETE FROM auth_sessions WHERE session_token_hash = $1', [
        hashToken(sessionToken),
      ]);
    }

    cookies.set(SESSION_COOKIE_NAME, '', {
      ...getSessionCookieOptions(),
      maxAge: 0,
    });

    return json({ success: true });
  } catch (error) {
    console.error('logout failed', error);
    return json({ error: 'Unable to log out.' }, 500);
  }
};

import type { APIRoute } from 'astro';

import {
  generateSessionToken,
  getSessionCookieOptions,
  hashToken,
  isValidEmail,
  normalizeEmail,
  SESSION_COOKIE_NAME,
} from '../../../lib/auth';
import { transaction } from '../../../lib/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body?.email ?? ''));
    const otp = String(body?.otp ?? '').trim();

    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
      return json({ error: 'Enter a valid email and 6-digit code.' }, 400);
    }

    const rawSessionToken = generateSessionToken();
    const sessionHash = hashToken(rawSessionToken);

    const result = await transaction(async (tx) => {
      const sessionRows = await tx.query<{ id: number; user_id: string }>(
        `SELECT id, user_id
        FROM auth_sessions
        WHERE email = $1
          AND otp_token_hash = $2
          AND otp_expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1`,
        [email, hashToken(otp)],
      );

      const authSession = sessionRows[0];
      if (!authSession) {
        return null;
      }

      const userId = authSession.user_id || email;

      await tx.query(
        `UPDATE auth_sessions
        SET user_id = $1,
            session_token_hash = $2,
            otp_token_hash = NULL,
            otp_expires_at = NULL,
            last_active_at = NOW()
        WHERE id = $3`,
        [userId, sessionHash, authSession.id],
      );

      const userRows = await tx.query<{ user_id: string }>(
        'SELECT user_id FROM user_settings WHERE user_id = $1 LIMIT 1',
        [userId],
      );

      const isNewUser = userRows.length === 0;

      if (isNewUser) {
        await tx.query(
          `INSERT INTO user_settings (
            user_id,
            timezone,
            ledger_mode,
            is_admin
          ) VALUES ($1, 'America/New_York', 'simple', false)`,
          [userId],
        );
      }

      await tx.query(
        `UPDATE email_waitlist
        SET converted_user_id = $1,
            converted_at = NOW()
        WHERE email = $2
          AND converted_user_id IS NULL`,
        [userId, email],
      );

      return { isNewUser };
    });

    if (!result) {
      return json({ error: 'Code is invalid or expired.' }, 401);
    }

    cookies.set(
      SESSION_COOKIE_NAME,
      rawSessionToken,
      getSessionCookieOptions(),
    );

    return json({ success: true, isNewUser: result.isNewUser });
  } catch (error) {
    console.error('verify-otp failed', error);
    return json({ error: 'Unable to verify login code.' }, 500);
  }
};

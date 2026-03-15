import type { APIRoute } from 'astro';

import {
  OTP_EXPIRY_MINUTES,
  generateOTP,
  generateSessionToken,
  hashToken,
  isValidEmail,
  normalizeEmail,
} from '../../../lib/auth';
import { transaction } from '../../../lib/db';
import { sendOTP } from '../../../lib/email';

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

    if (!isValidEmail(email)) {
      return json({ error: 'Enter a valid email address.' }, 400);
    }

    const otp = generateOTP();
    const otpHash = hashToken(otp);

    await transaction(async (tx) => {
      const existingRows = await tx.query<{ id: number }>(
        `SELECT id
        FROM auth_sessions
        WHERE email = $1
        ORDER BY created_at DESC
        LIMIT 1`,
        [email],
      );

      const existing = existingRows[0];

      if (existing) {
        await tx.query(
          `UPDATE auth_sessions
          SET user_id = $1,
              otp_token_hash = $2,
              otp_expires_at = NOW() + ($3 || ' minutes')::interval
          WHERE id = $4`,
          [email, otpHash, String(OTP_EXPIRY_MINUTES), existing.id],
        );
        return;
      }

      await tx.query(
        `INSERT INTO auth_sessions (
          user_id,
          email,
          session_token_hash,
          otp_token_hash,
          otp_expires_at
        ) VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval)`,
        [
          email,
          email,
          hashToken(generateSessionToken()),
          otpHash,
          String(OTP_EXPIRY_MINUTES),
        ],
      );
    });

    await sendOTP(email, otp);

    return json({ success: true });
  } catch (error) {
    console.error('request-otp failed', error);
    return json({ error: 'Unable to send login code.' }, 500);
  }
};

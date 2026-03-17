import type { APIRoute } from 'astro';

import {
  OTP_EXPIRY_MINUTES,
  generateOTP,
  generateSessionToken,
  hashToken,
  isHttpError,
  isValidEmail,
  normalizeEmail,
} from '../../../lib/auth';
import { transaction } from '../../../lib/db';
import { sendOTP } from '../../../lib/email';
import { createRateLimiter } from '../../../lib/rate-limit';

export const prerender = false;

const emailRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 3 });
const ipRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 10 });

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body?.email ?? ''));
    const ipAddress = getRequestIp(request);

    if (!isValidEmail(email)) {
      return json({ error: 'Enter a valid email address.' }, 400);
    }

    const ipLimit = ipRateLimiter.check(ipAddress);
    if (!ipLimit.allowed) {
      const retryMinutes = Math.max(1, Math.ceil(ipLimit.retryAfterMs / 60_000));
      return json(
        { error: `Too many login attempts. Try again in ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.` },
        429,
      );
    }

    const emailLimit = emailRateLimiter.check(email);
    if (!emailLimit.allowed) {
      const retryMinutes = Math.max(1, Math.ceil(emailLimit.retryAfterMs / 60_000));
      return json(
        {
          error: `Too many login attempts for this email. Try again in ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`,
        },
        429,
      );
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
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('[api/auth/request-otp]', error);
    return json({ error: 'Unable to send login code.' }, 500);
  }
};

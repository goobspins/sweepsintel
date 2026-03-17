import crypto from 'node:crypto';

import { query } from './db';

export interface SessionUser {
  userId: string;
  email: string;
  isAdmin: boolean;
  timezone: string;
  ledgerMode: 'simple' | 'advanced';
  trustScore: number;
  contributorTier: string;
  layoutSwap: boolean;
}

export const SESSION_COOKIE_NAME = 'session_token';
export const OTP_EXPIRY_MINUTES = 15;
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

class HttpError extends Error {
  status: number;
  location?: string;

  constructor(status: number, message: string, location?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.location = location;
  }
}

export class AuthRequiredError extends HttpError {
  constructor(location = '/') {
    super(302, 'Authentication required.', location);
    this.name = 'AuthRequiredError';
  }
}

export class AdminRequiredError extends HttpError {
  constructor() {
    super(403, 'Admin access required.');
    this.name = 'AdminRequiredError';
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function generateOTP() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getSessionCookieValue(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function isSessionExpired(lastActiveAt: string | Date) {
  const lastSeen = new Date(lastActiveAt);
  const expiresAt = lastSeen.getTime() + SESSION_MAX_AGE_SECONDS * 1000;
  return Number.isNaN(lastSeen.getTime()) || expiresAt <= Date.now();
}

export async function validateSession(
  request: Request,
): Promise<SessionUser | null> {
  const sessionToken = getSessionCookieValue(request);

  if (!sessionToken) {
    return null;
  }

  const sessionHash = hashToken(sessionToken);
  const rows = await query<{
    user_id: string;
    email: string;
    is_admin: boolean | null;
    timezone: string | null;
    ledger_mode: 'simple' | 'advanced' | null;
    trust_score: number | string | null;
    contributor_tier: string | null;
    layout_swap: boolean | null;
    last_active_at: string;
  }>(
    `SELECT
      s.user_id,
      s.email,
      us.is_admin,
      us.timezone,
      us.ledger_mode,
      us.trust_score,
      us.contributor_tier,
      us.layout_swap,
      s.last_active_at
    FROM auth_sessions s
    LEFT JOIN user_settings us ON us.user_id = s.user_id
    WHERE s.session_token_hash = $1
    LIMIT 1`,
    [sessionHash],
  );

  const session = rows[0];
  if (!session) {
    return null;
  }

  if (isSessionExpired(session.last_active_at)) {
    await query('DELETE FROM auth_sessions WHERE session_token_hash = $1', [
      sessionHash,
    ]);
    return null;
  }

  await query(
    'UPDATE auth_sessions SET last_active_at = NOW() WHERE session_token_hash = $1',
    [sessionHash],
  );

  return {
    userId: session.user_id,
    email: session.email,
    isAdmin: Boolean(session.is_admin),
    timezone: session.timezone ?? 'America/New_York',
    ledgerMode: session.ledger_mode ?? 'simple',
    trustScore: Number(session.trust_score ?? 0.5),
    contributorTier: session.contributor_tier ?? 'newcomer',
    layoutSwap: Boolean(session.layout_swap),
  };
}

export async function getSessionUser(request: Request) {
  return validateSession(request);
}

export async function requireAuth(request: Request) {
  const user = await validateSession(request);

  if (!user) {
    throw new AuthRequiredError('/');
  }

  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireAuth(request);

  if (!user.isAdmin) {
    throw new AdminRequiredError();
  }

  return user;
}


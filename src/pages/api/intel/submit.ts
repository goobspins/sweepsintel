import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';
import { submitUserSignal } from '../../../lib/intel';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const casinoId = Number(body?.casino_id);
    const signalType = String(body?.signal_type ?? '').trim();
    const title = String(body?.title ?? '').trim();
    const details = String(body?.details ?? '').trim();
    const expiresAt =
      typeof body?.expires_at === 'string' && body.expires_at.trim()
        ? body.expires_at.trim()
        : null;
    const isAnonymous = Boolean(body?.is_anonymous);

    if (!Number.isFinite(casinoId) || !signalType || !title || !details) {
      return json({ error: 'Casino, type, title, and details are required.' }, 400);
    }

    const eligibilityRows = await query<{
      account_age_days: number | string | null;
      claim_count: number | string | null;
      trust_score: number | string | null;
    }>(
      `SELECT
        EXTRACT(DAY FROM NOW() - us.created_at) AS account_age_days,
        COALESCE((SELECT COUNT(*)::int FROM daily_bonus_claims dbc WHERE dbc.user_id = us.user_id), 0) AS claim_count,
        COALESCE(us.trust_score, 0.5) AS trust_score
      FROM user_settings us
      WHERE us.user_id = $1
      LIMIT 1`,
      [user.userId],
    );

    const eligibility = eligibilityRows[0];
    if (!eligibility) {
      return json({ error: 'User settings not found.' }, 404);
    }

    const trustScore = Number(eligibility.trust_score ?? 0.5);
    const accountAgeDays = Number(eligibility.account_age_days ?? 0);
    const claimCount = Number(eligibility.claim_count ?? 0);
    if (trustScore < 0.65 && (accountAgeDays < 7 || claimCount < 5)) {
      return json({ error: 'Submitters need 7 days and 5 claims before posting signals.' }, 403);
    }

    const signal = await submitUserSignal({
      userId: user.userId,
      casinoId,
      signalType,
      title,
      details,
      expiresAt,
      isAnonymous,
    });

    return json({ success: true, signal }, 201);
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('intel/submit failed', error);
    return json({ error: 'Unable to submit signal.' }, 500);
  }
};

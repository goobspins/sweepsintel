import type { APIRoute } from 'astro';

import { query } from '../../../../lib/db';
import { submitUserSignal } from '../../../../lib/intel';
import { withRoute } from '../../../../lib/route';

export const prerender = false;

export const POST: APIRoute = withRoute(async (ctx) => {
  const body = ctx.body;
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
    return { _status: 400, error: 'Casino, type, title, and details are required.' };
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
      [ctx.user!.userId],
  );

  const eligibility = eligibilityRows[0];
  if (!eligibility) {
    return { _status: 404, error: 'User settings not found.' };
  }

  const trustScore = Number(eligibility.trust_score ?? 0.5);
  const accountAgeDays = Number(eligibility.account_age_days ?? 0);
  const claimCount = Number(eligibility.claim_count ?? 0);
  if (trustScore < 0.65 && (accountAgeDays < 7 || claimCount < 5)) {
    return { _status: 403, error: 'Submitters need 7 days and 5 claims before posting signals.' };
  }

  const signal = await submitUserSignal({
    userId: ctx.user!.userId,
    casinoId,
    signalType,
    title,
    details,
    expiresAt,
    isAnonymous,
  });

  return { _status: 201, success: true, signal };
});

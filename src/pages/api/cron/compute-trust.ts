import type { APIRoute } from 'astro';

import { isHttpError } from '../../../lib/auth';
import { computeAllTrustScores, evaluateAllContributorTiers } from '../../../lib/trust';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hasCronAccess(request: Request) {
  const expected = import.meta.env.CRON_SECRET;
  if (!expected) {
    return false;
  }
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token === expected;
}

export const GET: APIRoute = async ({ request }) => {
  if (!hasCronAccess(request)) {
    return json({ error: 'Unauthorized.' }, 401);
  }
  try {
    const trust = await computeAllTrustScores();
    const tiers = await evaluateAllContributorTiers();
    return json({ success: true, trust_updated: trust.length, tiers_updated: tiers.length });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('[api/cron/compute-trust]', error);
    return json({ error: 'Unable to compute trust scores.' }, 500);
  }
};

import type { APIRoute } from 'astro';

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
    console.error('cron/compute-trust failed', error);
    return json({ error: 'Unable to compute trust scores.' }, 500);
  }
};

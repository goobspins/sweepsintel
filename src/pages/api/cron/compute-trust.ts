import type { APIRoute } from 'astro';

import { withRoute } from '../../../lib/route';
import { computeAllTrustScores, evaluateAllContributorTiers } from '../../../lib/trust';

export const prerender = false;

export const GET: APIRoute = withRoute(async () => {
  const trust = await computeAllTrustScores();
  const tiers = await evaluateAllContributorTiers();
  return { success: true, trust_updated: trust.length, tiers_updated: tiers.length };
}, { auth: 'cron' });

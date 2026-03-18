import type { APIRoute } from 'astro';

import { withRoute } from '../../../lib/route';
import { getTrackerStatus } from '../../../lib/tracker';

export const prerender = false;

export const GET: APIRoute = withRoute(async (ctx) => {
  return getTrackerStatus(ctx.user!.userId);
});


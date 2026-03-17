import type { APIRoute } from 'astro';

import { computeAllCasinoHealth } from '../../../lib/health';

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
    await computeAllCasinoHealth();
    return json({ success: true });
  } catch (error) {
    console.error('cron/compute-health failed', error);
    return json({ error: 'Unable to compute casino health.' }, 500);
  }
};

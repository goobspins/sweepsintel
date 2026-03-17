import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { getHealthForTrackedCasinos } from '../../../lib/health';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const items = await getHealthForTrackedCasinos(user.userId);
    return json({ items });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('casinos/health failed', error);
    return json({ error: 'Unable to load casino health.' }, 500);
  }
};

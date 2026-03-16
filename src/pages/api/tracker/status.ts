import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { getTrackerStatus } from '../../../lib/tracker';

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
    const data = await getTrackerStatus(user.userId);
    return json(data);
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('tracker/status failed', error);
    return json({ error: 'Unable to load tracker status.' }, 500);
  }
};


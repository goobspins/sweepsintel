import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../../../lib/auth';
import { getCasinoHealthForUser } from '../../../../../lib/health';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireAuth(request);
    const casinoId = Number(params.id);
    if (!Number.isFinite(casinoId)) {
      return json({ error: 'Casino id is required.' }, 400);
    }
    const detail = await getCasinoHealthForUser(casinoId, user.userId);
    if (!detail) {
      return json({ error: 'Health detail not found.' }, 404);
    }
    return json({ detail });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('casinos/health-detail failed', error);
    return json({ error: 'Unable to load casino health detail.' }, 500);
  }
};

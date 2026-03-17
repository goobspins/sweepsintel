import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../../lib/auth';
import { voteOnSignal, type SignalVote } from '../../../../lib/intel';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireAuth(request);
    const signalId = Number(params.id);
    const body = await request.json();
    const vote = body?.vote === 'worked' || body?.vote === 'didnt_work'
      ? (body.vote as SignalVote)
      : null;

    if (!Number.isFinite(signalId) || !vote) {
      return json({ error: 'Signal id and vote are required.' }, 400);
    }

    const result = await voteOnSignal(signalId, user.userId, vote);
    return json({ success: true, ...result });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('intel/vote failed', error);
    return json({ error: 'Unable to save vote.' }, 500);
  }
};

import type { APIRoute } from 'astro';

import { voteOnSignal, type SignalVote } from '../../../../../lib/intel';
import { withRoute } from '../../../../../lib/route';

export const prerender = false;

export const POST: APIRoute = withRoute(async (ctx) => {
  const signalId = Number(ctx.params.id);
  const vote = ctx.body?.vote === 'worked' || ctx.body?.vote === 'didnt_work'
    ? (ctx.body.vote as SignalVote)
    : null;

  if (!Number.isFinite(signalId) || !vote) {
    return { _status: 400, error: 'Signal id and vote are required.' };
  }

  const result = await voteOnSignal(signalId, ctx.user!.userId, vote);
  return { success: true, ...result };
});

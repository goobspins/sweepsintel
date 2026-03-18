import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../../lib/auth';
import { addCasinoToTracker } from '../../../../lib/tracker';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const casinoId =
      body?.casino_id === null || body?.casino_id === undefined
        ? null
        : Number(body.casino_id);
    const casinoName =
      typeof body?.casino_name === 'string' ? body.casino_name.trim() : '';
    const fireAffiliate = Boolean(body?.fire_affiliate);

    if (!Number.isFinite(casinoId as number) && casinoName.length === 0) {
      return json({ error: 'Casino selection is required.' }, 400);
    }

    const result = await addCasinoToTracker({
      userId: user.userId,
      casinoId: Number.isFinite(casinoId as number) ? Number(casinoId) : null,
      casinoName: casinoName || null,
      fireAffiliate,
    });

    return json({
      success: true,
      affiliate_url: result.affiliateUrl,
      casino_id: result.casinoId,
      matched_existing: result.matchedExisting,
      created_suggested: result.createdSuggested,
      skipped_duplicate: result.skippedDuplicate,
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('tracker/add-casino failed', error);
    return json({ error: 'Unable to add casino.' }, 500);
  }
};




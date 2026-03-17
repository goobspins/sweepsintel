import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../../lib/auth';
import { emailToDisplayName } from '../../../../lib/format';
import { getSignalDetail } from '../../../../lib/intel';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, params }) => {
  try {
    await requireAuth(request);
    const signalId = Number(params.id);
    if (!Number.isFinite(signalId)) {
      return json({ error: 'Signal id is required.' }, 400);
    }

    const signal = await getSignalDetail(signalId);
    if (!signal) {
      return json({ error: 'Signal not found.' }, 404);
    }

    return json({
      signal: {
        id: signal.id,
        item_type: signal.item_type,
        title: signal.title,
        content: signal.content,
        created_at: signal.created_at,
        expires_at: signal.expires_at,
        confidence: signal.confidence,
        signal_status: signal.signal_status,
        worked_count: Number(signal.worked_count ?? 0),
        didnt_work_count: Number(signal.didnt_work_count ?? 0),
        casino: signal.casino_id
          ? {
              id: signal.casino_id,
              name: signal.casino_name,
              slug: signal.casino_slug,
              tier: signal.tier_label,
            }
          : null,
        attribution: signal.is_anonymous
          ? { display_name: null, contributor_tier: null }
          : {
              display_name: signal.submitted_by === null ? 'SweepsIntel Team' : emailToDisplayName(signal.submitted_by),
              contributor_tier: signal.submitted_by === null ? 'operator' : signal.contributor_tier,
            },
        related_signals: signal.related_signals,
      },
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('intel/signal detail failed', error);
    return json({ error: 'Unable to load signal detail.' }, 500);
  }
};

import type { APIRoute } from 'astro';

import { emailToDisplayName } from '../../../lib/format';
import { getIntelFeed } from '../../../lib/intel';
import { withRoute } from '../../../lib/route';

export const prerender = false;

export const GET: APIRoute = withRoute(async (ctx) => {
  const url = new URL(ctx.request.url);
  const casinoId = url.searchParams.get('casino_id');
  const type = url.searchParams.get('type');
  const since = url.searchParams.get('since');
  const limit = Number(url.searchParams.get('limit') ?? '50');
  const showCollapsed = url.searchParams.get('show_collapsed') === 'true';

  const items = await getIntelFeed({
    userId: ctx.user!.userId,
    casinoIds: casinoId ? [Number(casinoId)] : null,
    type,
    since,
    limit: Number.isFinite(limit) ? Math.min(100, Math.max(1, limit)) : 50,
    showCollapsed,
  });

  return {
    items: items.map((item) => ({
      id: item.id,
      item_type: item.item_type,
      title: item.title,
      content: item.content,
      created_at: item.created_at,
      expires_at: item.expires_at,
      confidence: item.confidence,
      signal_status: item.signal_status,
      worked_count: Number(item.worked_count ?? 0),
      didnt_work_count: Number(item.didnt_work_count ?? 0),
      casino: item.casino_id
        ? {
            id: item.casino_id,
            name: item.casino_name,
            slug: item.casino_slug,
            tier: item.tier_label,
          }
        : null,
      attribution: item.is_anonymous
        ? { display_name: null, contributor_tier: null }
        : {
            display_name: item.submitted_by === null ? 'SweepsIntel Team' : emailToDisplayName(item.submitted_by),
            contributor_tier: item.submitted_by === null ? 'operator' : item.contributor_tier,
          },
    })),
  };
});

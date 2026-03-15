import type { APIRoute } from 'astro';

import { discardIntelItem, publishIntelItem } from '../../../lib/discord-intel';
import { isHttpError, requireAdmin } from '../../../lib/auth';
import { sendPushToSegment } from '../../../lib/push';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const itemId = Number(body?.item_id);
    const action = body?.action === 'discard' ? 'discard' : 'publish';

    if (!Number.isFinite(itemId)) {
      return json({ error: 'Item id is required.' }, 400);
    }

    if (action === 'discard') {
      await discardIntelItem(itemId);
    } else {
      const item = await publishIntelItem(itemId);
      if (
        item &&
        item.confidence === 'high' &&
        item.casino_id !== null &&
        ['flash_sale', 'free_sc', 'promo_code'].includes(item.item_type)
      ) {
        await sendPushToSegment(
          { kind: 'casino', casinoId: item.casino_id },
          {
            title: `${item.casino_name ?? 'Casino'}: ${item.title}`,
            body: item.content.slice(0, 120),
            url: '/tracker',
          },
        );
      }
    }

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/discord-intel-action failed', error);
    return json({ error: 'Unable to process intel action.' }, 500);
  }
};

import type { APIRoute } from 'astro';

import { query } from '../../../lib/db';
import { publishIntelItem } from '../../../lib/discord-intel';
import { sendPushToSegment } from '../../../lib/push';

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

function shouldPush(item: {
  confidence: string;
  item_type: string;
  casino_id: number | null;
}) {
  return (
    item.confidence === 'high' &&
    item.casino_id !== null &&
    ['flash_sale', 'free_sc', 'promo_code'].includes(item.item_type)
  );
}

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!hasCronAccess(request)) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  try {
    const settings = await query<{ key: string; value: string }>(
      `SELECT key, value
      FROM admin_settings
      WHERE key IN ('auto_publish_enabled', 'auto_publish_delay_minutes')`,
    );

    const enabled = settings.find((row) => row.key === 'auto_publish_enabled')?.value === 'true';
    if (!enabled) {
      return json({ published: 0, skipped: 'disabled' });
    }

    const delay = Number(
      settings.find((row) => row.key === 'auto_publish_delay_minutes')?.value ?? '120',
    );

    const items = await query<{
      id: number;
      title: string;
      casino_id: number | null;
      item_type: string;
      content: string;
      confidence: string;
    }>(
      `SELECT id, title, casino_id, item_type, content, confidence
      FROM discord_intel_items
      WHERE is_published = false
        AND confidence = 'high'
        AND created_at < NOW() - INTERVAL '1 minute' * $1
        AND (expires_at IS NULL OR expires_at > NOW() + INTERVAL '3 hours')
        AND casino_id IS NOT NULL
        AND item_type NOT IN ('platform_warning', 'state_intel')`,
      [delay],
    );

    let published = 0;

    for (const item of items) {
      const publishedItem = await publishIntelItem(item.id, { autoPublished: true });
      if (!publishedItem) {
        continue;
      }

      published += 1;

      if (shouldPush(publishedItem)) {
        await sendPushToSegment(
          { kind: 'casino', casinoId: publishedItem.casino_id! },
          {
            title: `${publishedItem.casino_name ?? 'Casino'}: ${publishedItem.title}`,
            body: publishedItem.content.slice(0, 120),
            url: '/tracker',
          },
        );
      }
    }

    return json({ published });
  } catch (error) {
    console.error('cron/auto-publish failed', error);
    return json({ error: 'Unable to auto-publish intel.' }, 500);
  }
};

import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import { createAdminFlag } from '../../../lib/admin';
import {
  createIntelItem,
  requireDiscordIngestKey,
  type DiscordIntelPayload,
} from '../../../lib/discord-intel';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async () => methodNotAllowed(['POST']);

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!requireDiscordIngestKey(request)) {
      return json({ error: 'Unauthorized.' }, 401);
    }

    const body = (await request.json()) as DiscordIntelPayload;
    if (!body.item_type || !body.title || !body.content || !body.source_channel || !body.confidence || !body.confidence_reason) {
      return json({ error: 'Missing required ingest fields.' }, 400);
    }

    const created = await createIntelItem(body);

    if (body.admin_flag) {
      await createAdminFlag({
        source: 'discord_feed',
        flagType: mapIntelTypeToFlagType(body.item_type),
        casinoId: created.casinoId,
        flagContent: body.content,
        aiSummary: body.ai_summary ?? body.title,
        proposedAction: body.proposed_action ?? null,
      });
    }

    return json({ success: true, item_id: created.itemId, duplicate: created.duplicate });
  } catch (error) {
    console.error('discord/ingest failed', error);
    return json({ error: 'Unable to ingest intel.' }, 500);
  }
};

function mapIntelTypeToFlagType(itemType: string) {
  if (itemType === 'state_intel') {
    return 'potential_pullout';
  }
  if (itemType === 'platform_warning') {
    return 'data_anomaly';
  }
  return 'data_anomaly';
}




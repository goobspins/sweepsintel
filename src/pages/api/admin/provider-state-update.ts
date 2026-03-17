import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import { runProviderCascadeFlow } from '../../../lib/admin';
import { isHttpError, requireAdmin } from '../../../lib/auth';
import { query } from '../../../lib/db';
import { sendPushToSegment } from '../../../lib/push';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async () => methodNotAllowed(['POST']);

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const providerId = Number(body?.provider_id);
    const stateCode = String(body?.state_code ?? '');
    const status = String(body?.status ?? 'available');

    if (!Number.isFinite(providerId) || !stateCode) {
      return json({ error: 'Provider and state are required.' }, 400);
    }

    const providers = await query<{ id: number; name: string }>(
      'SELECT id, name FROM game_providers WHERE id = $1 LIMIT 1',
      [providerId],
    );
    const provider = providers[0];
    if (!provider) {
      return json({ error: 'Provider not found.' }, 404);
    }

    if (status === 'restricted') {
      const stateRows = await query<{ state_name: string }>(
        'SELECT state_name FROM state_legal_status WHERE state_code = $1 LIMIT 1',
        [stateCode],
      );
      const affected = await runProviderCascadeFlow({
        providerId,
        providerName: provider.name,
        stateCode,
        status: 'restricted',
      });

      await sendPushToSegment(
        { kind: 'state', stateCode },
        {
          title: `⚠️ Provider exit in ${stateRows[0]?.state_name ?? stateCode}`,
          body: `${provider.name} has stopped accepting players in ${stateRows[0]?.state_name ?? stateCode}.`,
          url: `/states/${stateCode.toLowerCase()}`,
        },
      );

      return json({ success: true, affected });
    }

    await query(
      `INSERT INTO provider_state_availability (
        provider_id,
        state_code,
        status,
        last_updated_at
      ) VALUES ($1, $2, $3, NOW())
      ON CONFLICT (provider_id, state_code)
      DO UPDATE SET
        status = EXCLUDED.status,
        last_updated_at = NOW()`,
      [providerId, stateCode, status],
    );

    return json({ success: true, affected: [] });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/provider-state-update failed', error);
    return json({ error: 'Unable to update provider state availability.' }, 500);
  }
};




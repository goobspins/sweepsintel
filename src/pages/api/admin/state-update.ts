import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import { runCasinoPulloutFlow } from '../../../lib/admin';
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
    const casinoId = Number(body?.casino_id);
    const stateCode = String(body?.state_code ?? '');
    const status = String(body?.status ?? 'available');
    const complianceNote = typeof body?.compliance_note === 'string' ? body.compliance_note : null;

    if (!Number.isFinite(casinoId) || !stateCode) {
      return json({ error: 'Casino and state are required.' }, 400);
    }

    if (status === 'legal_but_pulled_out') {
      const [casinoRows, stateRows] = await Promise.all([
        query<{ name: string }>('SELECT name FROM casinos WHERE id = $1 LIMIT 1', [casinoId]),
        query<{ state_name: string }>(
          'SELECT state_name FROM state_legal_status WHERE state_code = $1 LIMIT 1',
          [stateCode],
        ),
      ]);

      await runCasinoPulloutFlow({
        casinoId,
        stateCode,
        status: 'legal_but_pulled_out',
        message: complianceNote || `${stateCode} pullout confirmed.`,
        actionUrl: `/states/${stateCode}`,
      });

      await sendPushToSegment(
        { kind: 'state', stateCode },
        {
          title: `⚠️ ${casinoRows[0]?.name ?? 'Casino'} pulled out of ${stateRows[0]?.state_name ?? stateCode}`,
          body: complianceNote || `${casinoRows[0]?.name ?? 'A casino'} has stopped accepting players in ${stateRows[0]?.state_name ?? stateCode}.`,
          url: `/states/${stateCode.toLowerCase()}`,
        },
      );

      return json({ success: true });
    }

    await query(
      `INSERT INTO casino_state_availability (
        casino_id,
        state_code,
        status,
        compliance_note,
        verified,
        last_updated_at
      ) VALUES ($1, $2, $3, $4, true, NOW())
      ON CONFLICT (casino_id, state_code)
      DO UPDATE SET
        status = EXCLUDED.status,
        compliance_note = EXCLUDED.compliance_note,
        verified = true,
        last_updated_at = NOW()`,
      [casinoId, stateCode, status, complianceNote],
    );

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/state-update failed', error);
    return json({ error: 'Unable to update state availability.' }, 500);
  }
};




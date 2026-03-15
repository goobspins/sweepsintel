import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';
import { hashReporterIp } from '../../../lib/report-utils';

const VALID_STATUSES = new Set([
  'available',
  'restricted',
  'legal_but_pulled_out',
  'operates_despite_restrictions',
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async () => methodNotAllowed(['POST']);

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const casinoId = body?.casino_id === null || body?.casino_id === undefined || body?.casino_id === ''
      ? null
      : Number(body.casino_id);
    const providerId = body?.provider_id === null || body?.provider_id === undefined || body?.provider_id === ''
      ? null
      : Number(body.provider_id);
    const stateCode = typeof body?.state_code === 'string' ? body.state_code.trim().toUpperCase() : '';
    const reportedStatus = typeof body?.reported_status === 'string' ? body.reported_status : '';
    const reportText = typeof body?.report_text === 'string' ? body.report_text.trim() : '';

    if (!stateCode || stateCode.length !== 2) {
      return json({ error: 'state_code is required.' }, 400);
    }
    if (!VALID_STATUSES.has(reportedStatus)) {
      return json({ error: 'Invalid reported status.' }, 400);
    }
    if (reportText.length < 1) {
      return json({ error: 'Report text is required.' }, 400);
    }
    if (!Number.isFinite(casinoId ?? NaN) && !Number.isFinite(providerId ?? NaN)) {
      return json({ error: 'A casino or provider is required.' }, 400);
    }

    const rateLimitRows = await query<{ id: number }>(
      `SELECT id
      FROM state_availability_reports
      WHERE reporter_user_id = $1
        AND state_code = $2
        AND (($3::int IS NOT NULL AND casino_id = $3) OR ($4::int IS NOT NULL AND provider_id = $4))
        AND submitted_at > NOW() - INTERVAL '7 days'
      LIMIT 1`,
      [user.userId, stateCode, casinoId, providerId],
    );

    if (rateLimitRows.length > 0) {
      return json({ error: "You've already submitted a report for this topic this week." }, 409);
    }

    const reporterIpHash = hashReporterIp(request);
    const ipCountRows = await query<{ count: number | string }>(
      `SELECT COUNT(*)::int AS count
      FROM state_availability_reports
      WHERE reporter_ip_hash = $1
        AND state_code = $2
        AND (($3::int IS NOT NULL AND casino_id = $3) OR ($4::int IS NOT NULL AND provider_id = $4))
        AND submitted_at > NOW() - INTERVAL '7 days'`,
      [reporterIpHash, stateCode, casinoId, providerId],
    );
    const isFlagged = Number(ipCountRows[0]?.count ?? 0) >= 3;

    await query(
      `INSERT INTO state_availability_reports (
        casino_id,
        provider_id,
        state_code,
        reported_status,
        report_text,
        reporter_ip_hash,
        reporter_user_id,
        is_flagged,
        is_published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)`,
      [casinoId, providerId, stateCode, reportedStatus, reportText, reporterIpHash, user.userId, isFlagged],
    );

    return json({
      success: true,
      message: 'Your report has been submitted and will be reviewed before publishing. Thank you.',
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }

    console.error('reports/state-submit failed', error);
    return json({ error: 'Unable to submit state report.' }, 500);
  }
};



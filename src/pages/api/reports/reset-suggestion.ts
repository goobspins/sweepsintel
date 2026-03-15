import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';
import { hashReporterIp } from '../../../lib/report-utils';

const VALID_STREAK_MODES = new Set(['rolling', 'fixed']);

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

    const casinoId = Number(body?.casino_id);
    const suggestedStreakMode =
      typeof body?.suggested_streak_mode === 'string' && body.suggested_streak_mode
        ? body.suggested_streak_mode
        : null;
    const suggestedResetTime =
      typeof body?.suggested_reset_time === 'string' && body.suggested_reset_time.trim()
        ? body.suggested_reset_time.trim()
        : null;
    const suggestedTimezone =
      typeof body?.suggested_timezone === 'string' && body.suggested_timezone.trim()
        ? body.suggested_timezone.trim()
        : null;
    const evidenceText =
      typeof body?.evidence_text === 'string' ? body.evidence_text.trim() : '';

    if (!Number.isFinite(casinoId)) {
      return json({ error: 'Casino is required.' }, 400);
    }
    if (suggestedStreakMode && !VALID_STREAK_MODES.has(suggestedStreakMode)) {
      return json({ error: 'Invalid streak mode.' }, 400);
    }
    if (suggestedResetTime && !/^\d{2}:\d{2}$/.test(suggestedResetTime)) {
      return json({ error: 'Reset time must be HH:MM.' }, 400);
    }
    if (evidenceText.length < 1) {
      return json({ error: 'Evidence is required.' }, 400);
    }

    const existingRows = await query<{ id: number }>(
      `SELECT id
      FROM reset_time_suggestions
      WHERE reporter_user_id = $1
        AND casino_id = $2
        AND submitted_at > NOW() - INTERVAL '7 days'
      LIMIT 1`,
      [user.userId, casinoId],
    );

    if (existingRows.length > 0) {
      return json({ error: "You've already submitted a reset suggestion for this casino this week." }, 409);
    }

    const reporterIpHash = hashReporterIp(request);
    const ipCountRows = await query<{ count: number | string }>(
      `SELECT COUNT(*)::int AS count
      FROM reset_time_suggestions
      WHERE reporter_ip_hash = $1
        AND casino_id = $2
        AND submitted_at > NOW() - INTERVAL '7 days'`,
      [reporterIpHash, casinoId],
    );

    const shouldFlag = Number(ipCountRows[0]?.count ?? 0) >= 3;

    await query(
      `INSERT INTO reset_time_suggestions (
        casino_id,
        suggested_streak_mode,
        suggested_reset_time,
        suggested_timezone,
        evidence_text,
        reporter_ip_hash,
        reporter_user_id,
        status,
        admin_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
      [casinoId, suggestedStreakMode, suggestedResetTime, suggestedTimezone, evidenceText, reporterIpHash, user.userId, shouldFlag ? 'IP dedup threshold reached.' : null],
    );

    return json({
      success: true,
      message: 'Your report has been submitted and will be reviewed before publishing. Thank you.',
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }

    console.error('reports/reset-suggestion failed', error);
    return json({ error: 'Unable to submit reset suggestion.' }, 500);
  }
};



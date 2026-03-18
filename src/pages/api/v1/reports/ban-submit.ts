import type { APIRoute } from 'astro';

import { createAdminFlag } from '../../../../lib/admin';
import { isHttpError, requireAuth } from '../../../../lib/auth';
import { query } from '../../../../lib/db';
import { hashReporterIp } from '../../../../lib/report-utils';

export const prerender = false;

const VALID_REPORT_TYPES = new Set([
  'promoban',
  'hardban',
  'account_review',
  'fund_confiscation',
]);

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

    const casinoId = Number(body?.casino_id);
    const reportType = typeof body?.report_type === 'string' ? body.report_type : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';

    if (!Number.isFinite(casinoId)) {
      return json({ error: 'Casino is required.' }, 400);
    }
    if (!VALID_REPORT_TYPES.has(reportType)) {
      return json({ error: 'Invalid report type.' }, 400);
    }
    if (description.length < 1) {
      return json({ error: 'Description is required.' }, 400);
    }

    const [casinoRows, existingRows] = await Promise.all([
      query<{ id: number; name: string }>(
        `SELECT id, name FROM casinos WHERE id = $1 LIMIT 1`,
        [casinoId],
      ),
      query<{ id: number }>(
        `SELECT 1 AS id
        FROM ban_reports
        WHERE reporter_user_id = $1
          AND casino_id = $2
          AND submitted_at > NOW() - INTERVAL '7 days'
        LIMIT 1`,
        [user.userId, casinoId],
      ),
    ]);

    if (casinoRows.length === 0) {
      return json({ error: 'Casino not found.' }, 404);
    }
    if (existingRows.length > 0) {
      return json({ error: "You've already submitted a report for this casino this week." }, 409);
    }

    const reporterIpHash = hashReporterIp(request);
    const ipCountRows = await query<{ count: number | string }>(
      `SELECT COUNT(*)::int AS count
      FROM ban_reports
      WHERE reporter_ip_hash = $1
        AND casino_id = $2
        AND submitted_at > NOW() - INTERVAL '7 days'`,
      [reporterIpHash, casinoId],
    );
    const isFlagged = Number(ipCountRows[0]?.count ?? 0) >= 3;

    await query(
      `INSERT INTO ban_reports (
        casino_id,
        report_type,
        description,
        reporter_ip_hash,
        reporter_user_id,
        is_flagged,
        is_published
      ) VALUES ($1, $2, $3, $4, $5, $6, false)`,
      [casinoId, reportType, description, reporterIpHash, user.userId, isFlagged],
    );

    const uniqueCountRows = await query<{ count: number | string }>(
      `SELECT COUNT(DISTINCT reporter_user_id)::int AS count
      FROM ban_reports
      WHERE casino_id = $1
        AND submitted_at > NOW() - INTERVAL '7 days'`,
      [casinoId],
    );

    const uniqueCount = Number(uniqueCountRows[0]?.count ?? 0);

    if (uniqueCount >= 5) {
      const activeAlertRows = await query<{ id: number }>(
        `SELECT id
        FROM ban_uptick_alerts
        WHERE casino_id = $1
          AND is_active = true
        LIMIT 1`,
        [casinoId],
      );

      if (activeAlertRows.length === 0) {
        await query(
          `INSERT INTO ban_uptick_alerts (
            casino_id,
            report_count,
            window_days
          ) VALUES ($1, $2, 7)`,
          [casinoId, uniqueCount],
        );

        await createAdminFlag({
          source: 'ban_uptick',
          flagType: 'ban_surge',
          casinoId,
          flagContent: `${uniqueCount} unique ban reports in the last 7 days for ${casinoRows[0].name}.`,
          proposedAction: 'Review ban reports and decide whether to update risk or create an alert.',
        });
      }
    }

    return json({
      success: true,
      message: 'Your report has been submitted and will be reviewed before publishing. Thank you.',
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }

    console.error('reports/ban-submit failed', error);
    return json({ error: 'Unable to submit ban report.' }, 500);
  }
};




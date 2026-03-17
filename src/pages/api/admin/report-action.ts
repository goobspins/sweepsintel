import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import {
  createAdminFlag,
  logManualReportAudit,
  runCasinoPulloutFlow,
} from '../../../lib/admin';
import { isHttpError, requireAdmin } from '../../../lib/auth';
import { query } from '../../../lib/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async () => methodNotAllowed(['POST']);

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();
    const action = body?.action === 'reject' ? 'reject' : 'publish';
    const reportType = String(body?.report_type ?? '');
    const reportId = Number(body?.report_id);

    if (!Number.isFinite(reportId)) {
      return json({ error: 'Report id is required.' }, 400);
    }

    if (reportType === 'ban') {
      await query(
        `UPDATE ban_reports
        SET is_published = $1,
            admin_notes = COALESCE(admin_notes, '') || $2
        WHERE id = $3`,
        [action === 'publish', `\n${action} by ${admin.userId}`, reportId],
      );
      await logManualReportAudit({
        flagContent: `Ban report ${reportId} ${action}ed by ${admin.userId}.`,
      });
      return json({ success: true });
    }

    if (reportType === 'state') {
      const rows = await query<{
        casino_id: number | null;
        state_code: string | null;
        reported_status: 'available' | 'restricted' | 'legal_but_pulled_out' | 'operates_despite_restrictions';
        report_text: string;
      }>(
        `SELECT casino_id, state_code, reported_status, report_text
        FROM state_availability_reports
        WHERE id = $1
        LIMIT 1`,
        [reportId],
      );

      const report = rows[0];
      if (!report) {
        return json({ error: 'State report not found.' }, 404);
      }

      await query(
        `UPDATE state_availability_reports
        SET is_published = $1,
            admin_notes = COALESCE(admin_notes, '') || $2
        WHERE id = $3`,
        [action === 'publish', `\n${action} by ${admin.userId}`, reportId],
      );

      if (action === 'publish' && report.casino_id && report.state_code) {
        if (report.reported_status === 'legal_but_pulled_out') {
          await runCasinoPulloutFlow({
            casinoId: report.casino_id,
            stateCode: report.state_code,
            status: report.reported_status,
            message: report.report_text,
            actionUrl: `/states/${report.state_code}`,
          });
        } else {
          await query(
            `INSERT INTO casino_state_availability (
              casino_id,
              state_code,
              status,
              community_reported,
              verified,
              last_updated_at
            ) VALUES ($1, $2, $3, true, true, NOW())
            ON CONFLICT (casino_id, state_code)
            DO UPDATE SET
              status = EXCLUDED.status,
              community_reported = true,
              verified = true,
              last_updated_at = NOW()`,
            [report.casino_id, report.state_code, report.reported_status],
          );
        }
      }

      await logManualReportAudit({
        casinoId: report.casino_id,
        stateCode: report.state_code,
        flagContent: `State report ${reportId} ${action}ed by ${admin.userId}.`,
      });
      return json({ success: true });
    }

    if (reportType === 'reset') {
      const rows = await query<{
        casino_id: number | null;
        suggested_reset_mode: string | null;
        suggested_reset_time: string | null;
        suggested_timezone: string | null;
      }>(
        `SELECT casino_id, suggested_reset_mode, suggested_reset_time, suggested_timezone
        FROM reset_time_suggestions
        WHERE id = $1
        LIMIT 1`,
        [reportId],
      );

      const report = rows[0];
      if (!report) {
        return json({ error: 'Reset suggestion not found.' }, 404);
      }

      await query(
        `UPDATE reset_time_suggestions
        SET status = $1,
            admin_notes = COALESCE(admin_notes, '') || $2
        WHERE id = $3`,
        [action === 'publish' ? 'accepted' : 'rejected', `\n${action} by ${admin.userId}`, reportId],
      );

      if (action === 'publish' && report.casino_id) {
        await query(
          `UPDATE casinos
          SET reset_mode = COALESCE($1, reset_mode),
              reset_time_local = COALESCE($2, reset_time_local),
              reset_timezone = COALESCE($3, reset_timezone),
              last_updated_at = NOW()
          WHERE id = $4`,
          [
            report.suggested_reset_mode,
            report.suggested_reset_time,
            report.suggested_timezone,
            report.casino_id,
          ],
        );
      }

      await createAdminFlag({
        source: 'manual',
        flagType: 'data_anomaly',
        casinoId: report.casino_id,
        flagContent: `Reset suggestion ${reportId} ${action}ed by ${admin.userId}.`,
      });
      return json({ success: true });
    }

    return json({ error: 'Unsupported report type.' }, 400);
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/report-action failed', error);
    return json({ error: 'Unable to process report action.' }, 500);
  }
};




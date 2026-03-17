import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import {
  createAdminFlag,
  markFlagStatus,
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
    const flagId = Number(body?.flag_id);
    const action = body?.action === 'dismiss' ? 'dismiss' : 'act';
    const note = typeof body?.note === 'string' ? body.note : null;

    if (!Number.isFinite(flagId)) {
      return json({ error: 'Flag id is required.' }, 400);
    }

    const flags = await query<{
      id: number;
      flag_type: string;
      casino_id: number | null;
      state_code: string | null;
      flag_content: string;
    }>(
      `SELECT id, flag_type, casino_id, state_code, flag_content
      FROM admin_flags
      WHERE id = $1
      LIMIT 1`,
      [flagId],
    );

    const flag = flags[0];
    if (!flag) {
      return json({ error: 'Flag not found.' }, 404);
    }

    if (action === 'dismiss') {
      await markFlagStatus({
        flagId,
        status: 'dismissed',
        userId: admin.userId,
        note,
      });
      return json({ success: true });
    }

    switch (flag.flag_type) {
      case 'potential_pullout':
        if (!flag.casino_id || !flag.state_code) {
          return json({ error: 'Flag is missing casino or state context.' }, 400);
        }
        await runCasinoPulloutFlow({
          casinoId: flag.casino_id,
          stateCode: flag.state_code,
          status: body?.status ?? 'legal_but_pulled_out',
          message: note || flag.flag_content,
          actionUrl: `/states/${flag.state_code}`,
        });
        break;
      case 'ban_surge':
        if (flag.casino_id && body?.update_promoban_risk) {
          await query(
            `UPDATE casinos
            SET promoban_risk = $1,
                last_updated_at = NOW()
            WHERE id = $2`,
            [body.promoban_risk ?? 'high', flag.casino_id],
          );
        }
        if (flag.casino_id && body?.create_ban_uptick_alert) {
          await query(
            `INSERT INTO ban_uptick_alerts (casino_id, report_count)
            VALUES ($1, $2)`,
            [flag.casino_id, body.report_count ?? 5],
          );
        }
        break;
      case 'redemption_slowdown':
        if (flag.casino_id) {
          await query(
            `UPDATE casinos
            SET redemption_speed_desc = $1,
                last_updated_at = NOW()
            WHERE id = $2`,
            [body.redemption_speed_desc ?? note ?? 'Processing times slowing', flag.casino_id],
          );
        }
        break;
      case 'data_anomaly':
      case 'broken_platform_feature':
        break;
      case 'new_casino_signal': {
        const name = String(body?.casino_name ?? '').trim();
        const slug = String(body?.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).slice(0, 50);
        const created = await query<{ id: number }>(
          `INSERT INTO casinos (slug, name, source, has_affiliate_link, is_excluded)
          VALUES ($1, $2, 'admin', false, false)
          RETURNING id`,
          [slug, name || 'New Casino'],
        );
        await markFlagStatus({
          flagId,
          status: 'actioned',
          userId: admin.userId,
          note: `Created casino ${created[0].id}`,
        });
        return json({ success: true, redirect_id: created[0].id });
      }
      case 'premium_content_candidate':
        await createAdminFlag({
          source: 'manual',
          flagType: 'premium_content_candidate',
          casinoId: flag.casino_id,
          stateCode: flag.state_code,
          flagContent: `${flag.flag_content}\nCategory: ${body?.category ?? 'general'}`,
        });
        break;
      case 'positive_redemption':
        break;
      case 'game_availability_change':
        if (body?.confirm_removal && flag.casino_id && body?.game_name) {
          await query(
            `UPDATE casino_game_availability
            SET status = 'removed',
                updated_at = NOW()
            WHERE casino_id = $1
              AND game_name = $2`,
            [flag.casino_id, body.game_name],
          );
        }
        break;
      default:
        break;
    }

    await markFlagStatus({
      flagId,
      status: 'actioned',
      userId: admin.userId,
      note,
    });

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/flag-action failed', error);
    return json({ error: 'Unable to process flag action.' }, 500);
  }
};




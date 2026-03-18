import type { APIRoute } from 'astro';

import { query } from '../../../lib/db';
import { withRoute } from '../../../lib/route';

export const prerender = false;

export const POST: APIRoute = withRoute(async (ctx) => {
  const body = ctx.body;
  const casinoId = Number(body?.casino_id);
  const signalType = String(body?.signal_type ?? '').trim();
  const title = String(body?.title ?? '').trim();
  const details = String(body?.details ?? '').trim();
  const expiresAt =
    typeof body?.expires_at === 'string' && body.expires_at.trim()
      ? body.expires_at.trim()
      : null;

  if (!Number.isFinite(casinoId) || !signalType || !title || !details) {
    return { _status: 400, error: 'Casino, type, title, and details are required.' };
  }

  const rows = await query(
    `INSERT INTO discord_intel_items (
      item_type,
      casino_id,
      title,
      content,
      expires_at,
      confidence,
      confidence_reason,
      is_published,
      source,
      submitted_by,
      is_anonymous,
      signal_status
    ) VALUES ($1, $2, $3, $4, $5, 'high', 'Posted by SweepsIntel Team.', true, 'admin', NULL, false, 'active')
    RETURNING id, item_type, title, content, created_at, expires_at, confidence, signal_status`,
    [signalType, casinoId, title, details, expiresAt],
  );

  return { _status: 201, success: true, signal: rows[0] };
}, { auth: 'admin' });

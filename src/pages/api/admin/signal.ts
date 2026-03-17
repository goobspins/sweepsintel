import type { APIRoute } from 'astro';

import { isHttpError, requireAdmin } from '../../../lib/auth';
import { query } from '../../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const casinoId = Number(body?.casino_id);
    const signalType = String(body?.signal_type ?? '').trim();
    const title = String(body?.title ?? '').trim();
    const details = String(body?.details ?? '').trim();
    const expiresAt =
      typeof body?.expires_at === 'string' && body.expires_at.trim()
        ? body.expires_at.trim()
        : null;

    if (!Number.isFinite(casinoId) || !signalType || !title || !details) {
      return json({ error: 'Casino, type, title, and details are required.' }, 400);
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

    return json({ success: true, signal: rows[0] }, 201);
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/signal failed', error);
    return json({ error: 'Unable to create admin signal.' }, 500);
  }
};

import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';

import { requireAdmin, isHttpError } from '../../../lib/auth';
import { createNotificationsForSegment } from '../../../lib/notifications';

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
    const title = String(body?.title ?? '').trim();
    const message = String(body?.message ?? '').trim();
    const actionUrl = typeof body?.action_url === 'string' ? body.action_url : null;
    const segment = String(body?.segment ?? 'all');

    if (!title || !message) {
      return json({ error: 'Title and message are required.' }, 400);
    }

    if (segment === 'state') {
      await createNotificationsForSegment(
        { kind: 'state', stateCode: String(body?.state_code ?? '') },
        { notificationType: 'system', title, message, actionUrl, stateCode: String(body?.state_code ?? '') },
      );
    } else if (segment === 'casino') {
      await createNotificationsForSegment(
        { kind: 'casino', casinoId: Number(body?.casino_id) },
        { notificationType: 'system', title, message, actionUrl, casinoId: Number(body?.casino_id) },
      );
    } else {
      await createNotificationsForSegment(
        { kind: 'all' },
        { notificationType: 'system', title, message, actionUrl },
      );
    }

    return json({ success: true });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/notify failed', error);
    return json({ error: 'Unable to send notifications.' }, 500);
  }
};



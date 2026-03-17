import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadPreferences(userId: string) {
  await query(
    `INSERT INTO user_notification_preferences (user_id)
    VALUES ($1)
    ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  const rows = await query(
    `SELECT
      push_warnings,
      push_deals,
      push_free_sc,
      push_streak_reminders,
      email_digest_frequency,
      updated_at
    FROM user_notification_preferences
    WHERE user_id = $1
    LIMIT 1`,
    [userId],
  );
  return rows[0];
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    return json(await loadPreferences(user.userId));
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('notifications/preferences GET failed', error);
    return json({ error: 'Unable to load notification preferences.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const emailDigestFrequency =
      typeof body?.email_digest_frequency === 'string' &&
      ['none', 'daily', 'weekly'].includes(body.email_digest_frequency)
        ? body.email_digest_frequency
        : 'none';

    await query(
      `INSERT INTO user_notification_preferences (
        user_id,
        push_warnings,
        push_deals,
        push_free_sc,
        push_streak_reminders,
        email_digest_frequency,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        push_warnings = EXCLUDED.push_warnings,
        push_deals = EXCLUDED.push_deals,
        push_free_sc = EXCLUDED.push_free_sc,
        push_streak_reminders = EXCLUDED.push_streak_reminders,
        email_digest_frequency = EXCLUDED.email_digest_frequency,
        updated_at = NOW()`,
      [
        user.userId,
        Boolean(body?.push_warnings ?? true),
        Boolean(body?.push_deals ?? true),
        Boolean(body?.push_free_sc ?? true),
        Boolean(body?.push_streak_reminders ?? false),
        emailDigestFrequency,
      ],
    );

    return json(await loadPreferences(user.userId));
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('notifications/preferences POST failed', error);
    return json({ error: 'Unable to save notification preferences.' }, 500);
  }
};

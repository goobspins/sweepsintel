import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';
import { isHttpError } from '../../../lib/auth';
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
    const body = await request.json();
    const casinoId = Number(body?.casino_id);
    const casinoSlug = body?.casino_slug ? String(body.casino_slug) : null;
    const userId = body?.user_id ? String(body.user_id) : null;
    const referrerSource = body?.referrer_source
      ? String(body.referrer_source)
      : 'casino_profile';

    if (!Number.isFinite(casinoId) && !casinoSlug) {
      return json({ error: 'Invalid casino identifier.' }, 400);
    }

    const casinos = await query<{
      id: number;
      affiliate_link_url: string | null;
      has_affiliate_link: boolean;
    }>(
      `SELECT id, affiliate_link_url, has_affiliate_link
      FROM casinos
      WHERE id = $1 OR slug = $2
      LIMIT 1`,
      [Number.isFinite(casinoId) ? casinoId : null, casinoSlug],
    );

    const casino = casinos[0];
    if (!casino || !casino.has_affiliate_link || !casino.affiliate_link_url) {
      return json({ error: 'Affiliate link unavailable.' }, 404);
    }

    await query(
      `INSERT INTO clicks (casino_id, user_id, referrer_source)
      VALUES ($1, $2, $3)`,
      [casino.id, userId, referrerSource],
    );

    return json({ url: casino.affiliate_link_url });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('[api/affiliate/click]', error);
    return json({ error: 'Unable to resolve affiliate link.' }, 500);
  }
};




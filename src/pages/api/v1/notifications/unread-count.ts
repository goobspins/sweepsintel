import type { APIRoute } from 'astro';

import { query } from '../../../../lib/db';
import { withRoute } from '../../../../lib/route';

export const prerender = false;

export const GET: APIRoute = withRoute(async (ctx) => {
  const rows = await query<{ count: number | string }>(
    `SELECT COUNT(*)::int AS count
    FROM user_notifications
    WHERE user_id = $1
      AND is_read = false`,
    [ctx.user!.userId],
  );

  return { count: Number(rows[0]?.count ?? 0) };
});


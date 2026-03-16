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

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const term = url.searchParams.get('q')?.trim() ?? '';
    if (term.length < 2) {
      return json({ results: [] });
    }

    const results = await query<{
      id: number;
      name: string;
      slug: string;
      tier: string | null;
      source: string;
    }>(
      `SELECT c.id, c.name, c.slug, c.tier_label AS tier, c.source
      FROM casinos c
      WHERE name ILIKE $1
      ORDER BY
        CASE WHEN c.source = 'admin' THEN 0 ELSE 1 END,
        c.name ASC
      LIMIT 5`,
      [`%${term}%`],
    );

    return json({ results });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('tracker/search failed', error);
    return json({ error: 'Unable to search casinos.' }, 500);
  }
};


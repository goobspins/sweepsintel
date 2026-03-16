import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';
import { normalizeCasinoName } from '../../../lib/tracker';

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
      return json({ results: [], near_match: null, normalized_query: '' });
    }
    const normalizedTerm = normalizeCasinoName(term);

    const results = await query<{
      id: number;
      name: string;
      slug: string;
      tier: string | null;
      source: string;
      normalized_name: string | null;
      normalized_match_rank: number;
    }>(
      `SELECT
        c.id,
        c.name,
        c.slug,
        c.tier_label AS tier,
        c.source,
        c.normalized_name,
        CASE
          WHEN c.normalized_name = $2 THEN 0
          WHEN c.normalized_name ILIKE '%' || $2 || '%' THEN 1
          ELSE 2
        END AS normalized_match_rank
      FROM casinos c
      WHERE c.name ILIKE $1
        OR c.normalized_name ILIKE '%' || $2 || '%'
      ORDER BY
        normalized_match_rank ASC,
        CASE WHEN c.source = 'admin' THEN 0 ELSE 1 END,
        c.name ASC
      LIMIT 5`,
      [`%${term}%`, normalizedTerm],
    );

    const nearMatch =
      results.find((result) => result.normalized_name === normalizedTerm) ?? null;

    return json({
      results: results.map(({ normalized_name, normalized_match_rank, ...result }) => result),
      near_match: nearMatch
        ? {
            id: nearMatch.id,
            name: nearMatch.name,
            slug: nearMatch.slug,
            tier: nearMatch.tier,
            source: nearMatch.source,
          }
        : null,
      normalized_query: normalizedTerm,
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('tracker/search failed', error);
    return json({ error: 'Unable to search casinos.' }, 500);
  }
};


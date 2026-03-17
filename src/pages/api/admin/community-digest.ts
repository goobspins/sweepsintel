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

function intervalSql(period: string) {
  if (period === '30d') return "30 days";
  if (period === '24h') return "24 hours";
  return "7 days";
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAdmin(request);
    const period = intervalSql(url.searchParams.get('period') ?? '7d');

    const [summaryRows, flaggedUsers, topContributors] = await Promise.all([
      query<{
        total_signals: number | string | null;
        worked_signals: number | string | null;
        disputed_signals: number | string | null;
        unverified_signals: number | string | null;
        user_signals: number | string | null;
      }>(
        `SELECT
          COUNT(*)::int AS total_signals,
          COUNT(*) FILTER (WHERE worked_count > didnt_work_count)::int AS worked_signals,
          COUNT(*) FILTER (WHERE signal_status IN ('likely_outdated', 'collapsed'))::int AS disputed_signals,
          COUNT(*) FILTER (WHERE confidence = 'unverified')::int AS unverified_signals,
          COUNT(*) FILTER (WHERE source = 'user')::int AS user_signals
        FROM discord_intel_items
        WHERE created_at >= NOW() - INTERVAL '${period}'`,
      ),
      query<{
        user_id: string;
        trust_score: number | string | null;
        contributor_tier: string | null;
      }>(
        `SELECT user_id, trust_score, contributor_tier
        FROM user_settings
        WHERE COALESCE(trust_score, 0) < 0.20
        ORDER BY trust_score ASC
        LIMIT 20`,
      ),
      query<{
        user_id: string;
        contributor_tier: string | null;
        signal_count: number | string | null;
        worked_votes: number | string | null;
        didnt_work_votes: number | string | null;
      }>(
        `SELECT
          di.submitted_by AS user_id,
          us.contributor_tier,
          COUNT(*)::int AS signal_count,
          COALESCE(SUM(di.worked_count), 0) AS worked_votes,
          COALESCE(SUM(di.didnt_work_count), 0) AS didnt_work_votes
        FROM discord_intel_items di
        LEFT JOIN user_settings us ON us.user_id = di.submitted_by
        WHERE di.source = 'user'
          AND di.created_at >= NOW() - INTERVAL '${period}'
          AND di.submitted_by IS NOT NULL
        GROUP BY di.submitted_by, us.contributor_tier
        ORDER BY signal_count DESC, worked_votes DESC
        LIMIT 10`,
      ),
    ]);

    return json({
      summary: summaryRows[0] ?? {
        total_signals: 0,
        worked_signals: 0,
        disputed_signals: 0,
        unverified_signals: 0,
        user_signals: 0,
      },
      flagged_users: flaggedUsers.map((row) => ({
        ...row,
        trust_score: Number(row.trust_score ?? 0),
      })),
      top_contributors: topContributors.map((row) => ({
        ...row,
        signal_count: Number(row.signal_count ?? 0),
        worked_votes: Number(row.worked_votes ?? 0),
        didnt_work_votes: Number(row.didnt_work_votes ?? 0),
      })),
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/community-digest failed', error);
    return json({ error: 'Unable to load community digest.' }, 500);
  }
};

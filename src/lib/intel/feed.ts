import { query } from '../db';

export type FeedOptions = {
  userId: string;
  casinoIds?: number[] | null;
  type?: string | null;
  since?: string | null;
  limit?: number;
  showCollapsed?: boolean;
};

function normalizeTypeFilter(type?: string | null) {
  if (!type || type === 'all') return null;
  if (type === 'deals') return ['flash_sale', 'playthrough_deal'];
  if (type === 'promos') return ['promo_code'];
  if (type === 'free_sc') return ['free_sc'];
  if (type === 'warnings') return ['platform_warning'];
  if (type === 'strategy') return ['general_tip'];
  return [type];
}

export async function getIntelFeed(options: FeedOptions) {
  const casinoIds =
    options.casinoIds && options.casinoIds.length > 0
      ? options.casinoIds
      : (
          await query<{ casino_id: number }>(
            `SELECT casino_id
            FROM user_casino_settings
            WHERE user_id = $1
              AND removed_at IS NULL`,
            [options.userId],
          )
        ).map((row) => row.casino_id);

  if (casinoIds.length === 0) {
    return [];
  }

  const typeFilter = normalizeTypeFilter(options.type);
  return query<{
    id: number;
    item_type: string;
    title: string;
    content: string;
    created_at: string;
    expires_at: string | null;
    confidence: string;
    signal_status: string;
    worked_count: number | string | null;
    didnt_work_count: number | string | null;
    casino_id: number | null;
    casino_name: string | null;
    casino_slug: string | null;
    tier_label: string | null;
    submitted_by: string | null;
    is_anonymous: boolean;
    contributor_tier: string | null;
  }>(
    `SELECT
      di.id,
      di.item_type,
      di.title,
      di.content,
      di.created_at,
      di.expires_at,
      di.confidence,
      COALESCE(di.signal_status, 'active') AS signal_status,
      COALESCE(di.worked_count, 0) AS worked_count,
      COALESCE(di.didnt_work_count, 0) AS didnt_work_count,
      di.casino_id,
      c.name AS casino_name,
      c.slug AS casino_slug,
      c.tier_label,
      di.submitted_by,
      COALESCE(di.is_anonymous, false) AS is_anonymous,
      us.contributor_tier
    FROM discord_intel_items di
    LEFT JOIN casinos c ON c.id = di.casino_id
    LEFT JOIN user_settings us ON us.user_id = di.submitted_by
    WHERE di.is_published = true
      AND di.casino_id = ANY($1::int[])
      AND (
        COALESCE(di.signal_status, 'active') IN ('active', 'conditional', 'likely_outdated')
        OR ($2::boolean = true AND COALESCE(di.signal_status, 'active') = 'collapsed')
      )
      AND ($3::text[] IS NULL OR di.item_type = ANY($3::text[]))
      AND ($4::timestamptz IS NULL OR di.created_at >= $4)
    ORDER BY
      CASE COALESCE(di.signal_status, 'active')
        WHEN 'active' THEN 0
        WHEN 'conditional' THEN 1
        WHEN 'likely_outdated' THEN 2
        ELSE 3
      END,
      CASE WHEN di.expires_at IS NOT NULL AND di.expires_at < NOW() THEN 1 ELSE 0 END,
      di.created_at DESC
    LIMIT $5`,
    [casinoIds, Boolean(options.showCollapsed), typeFilter, options.since ?? null, options.limit ?? 50],
  );
}

export async function getSignalDetail(signalId: number) {
  const rows = await query<{
    id: number;
    item_type: string;
    title: string;
    content: string;
    created_at: string;
    expires_at: string | null;
    confidence: string;
    signal_status: string;
    worked_count: number | string | null;
    didnt_work_count: number | string | null;
    casino_id: number | null;
    casino_name: string | null;
    casino_slug: string | null;
    tier_label: string | null;
    submitted_by: string | null;
    is_anonymous: boolean;
    contributor_tier: string | null;
  }>(
    `SELECT
      di.id,
      di.item_type,
      di.title,
      di.content,
      di.created_at,
      di.expires_at,
      di.confidence,
      COALESCE(di.signal_status, 'active') AS signal_status,
      COALESCE(di.worked_count, 0) AS worked_count,
      COALESCE(di.didnt_work_count, 0) AS didnt_work_count,
      di.casino_id,
      c.name AS casino_name,
      c.slug AS casino_slug,
      c.tier_label,
      di.submitted_by,
      COALESCE(di.is_anonymous, false) AS is_anonymous,
      us.contributor_tier
    FROM discord_intel_items di
    LEFT JOIN casinos c ON c.id = di.casino_id
    LEFT JOIN user_settings us ON us.user_id = di.submitted_by
    WHERE di.id = $1
    LIMIT 1`,
    [signalId],
  );

  const signal = rows[0];
  if (!signal) return null;

  const relatedSignals =
    signal.casino_id === null
      ? []
      : await query<{
          id: number;
          title: string;
          item_type: string;
          created_at: string;
        }>(
          `SELECT id, title, item_type, created_at
          FROM discord_intel_items
          WHERE casino_id = $1
            AND id <> $2
            AND is_published = true
            AND created_at >= NOW() - INTERVAL '7 days'
          ORDER BY created_at DESC
          LIMIT 5`,
          [signal.casino_id, signalId],
        );

  return {
    ...signal,
    worked_count: Number(signal.worked_count ?? 0),
    didnt_work_count: Number(signal.didnt_work_count ?? 0),
    related_signals: relatedSignals,
  };
}

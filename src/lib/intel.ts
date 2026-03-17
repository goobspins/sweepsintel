import { query, transaction } from './db';

const CONDITIONAL_MIN_TOTAL_VOTES = 4;
const LIKELY_OUTDATED_MIN_TOTAL_VOTES = 8;
const LIKELY_OUTDATED_NEGATIVE_RATIO = 0.8;
const COLLAPSED_MIN_TOTAL_VOTES = 12;
const COLLAPSED_NEGATIVE_RATIO = 0.9;

export type SignalVote = 'worked' | 'didnt_work';

type FeedOptions = {
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

export async function submitUserSignal(options: {
  userId: string;
  casinoId: number;
  signalType: string;
  title: string;
  details: string;
  expiresAt?: string | null;
  isAnonymous?: boolean;
}) {
  const trustRows = await query<{ trust_score: number | string | null }>(
    `SELECT trust_score
    FROM user_settings
    WHERE user_id = $1
    LIMIT 1`,
    [options.userId],
  );
  const trustScore = Number(trustRows[0]?.trust_score ?? 0.5);
  const confidence = trustScore > 0.7 ? 'medium' : 'unverified';

  const rows = await query<{
    id: number;
    casino_id: number | null;
    item_type: string;
    title: string;
    content: string;
    expires_at: string | null;
    confidence: string;
    signal_status: string;
    created_at: string;
    is_anonymous: boolean;
  }>(
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
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'user', $8, $9, 'active')
    RETURNING id, casino_id, item_type, title, content, expires_at, confidence, signal_status, created_at, is_anonymous`,
    [
      options.signalType,
      options.casinoId,
      options.title.trim(),
      options.details.trim(),
      options.expiresAt ?? null,
      confidence,
      confidence === 'medium' ? 'Elevated by user trust score.' : 'New community signal.',
      options.userId,
      Boolean(options.isAnonymous),
    ],
  );

  return rows[0];
}

export async function updateSignalStatus(signalId: number) {
  const rows = await query<{
    worked_count: number | string | null;
    didnt_work_count: number | string | null;
  }>(
    `SELECT worked_count, didnt_work_count
    FROM discord_intel_items
    WHERE id = $1
    LIMIT 1`,
    [signalId],
  );
  const row = rows[0];
  if (!row) return null;

  const worked = Number(row.worked_count ?? 0);
  const didntWork = Number(row.didnt_work_count ?? 0);
  const total = worked + didntWork;
  const negativeRatio = total > 0 ? didntWork / total : 0;
  let signalStatus = 'active';

  if (total >= COLLAPSED_MIN_TOTAL_VOTES && negativeRatio >= COLLAPSED_NEGATIVE_RATIO) {
    signalStatus = 'collapsed';
  } else if (total >= LIKELY_OUTDATED_MIN_TOTAL_VOTES && negativeRatio >= LIKELY_OUTDATED_NEGATIVE_RATIO) {
    signalStatus = 'likely_outdated';
  } else if (worked > 0 && didntWork > 0 && total >= CONDITIONAL_MIN_TOTAL_VOTES) {
    signalStatus = 'conditional';
  }

  await query(
    `UPDATE discord_intel_items
    SET signal_status = $2
    WHERE id = $1`,
    [signalId, signalStatus],
  );

  return signalStatus;
}

export async function voteOnSignal(signalId: number, userId: string, vote: SignalVote) {
  return transaction(async (tx) => {
    await tx.query(
      `INSERT INTO signal_votes (signal_id, user_id, vote)
      VALUES ($1, $2, $3)
      ON CONFLICT (signal_id, user_id)
      DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW()`,
      [signalId, userId, vote],
    );

    const updatedRows = await tx.query<{
      worked_count: number | string | null;
      didnt_work_count: number | string | null;
    }>(
      `UPDATE discord_intel_items
      SET worked_count = (
            SELECT COUNT(*)::int
            FROM signal_votes
            WHERE signal_id = $1 AND vote = 'worked'
          ),
          didnt_work_count = (
            SELECT COUNT(*)::int
            FROM signal_votes
            WHERE signal_id = $1 AND vote = 'didnt_work'
          )
      WHERE id = $1
      RETURNING worked_count, didnt_work_count`,
      [signalId],
    );

    const counts = updatedRows[0] ?? { worked_count: 0, didnt_work_count: 0 };
    const signalStatus = await updateSignalStatus(signalId);

    return {
      worked_count: Number(counts.worked_count ?? 0),
      didnt_work_count: Number(counts.didnt_work_count ?? 0),
      signal_status: signalStatus ?? 'active',
    };
  });
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

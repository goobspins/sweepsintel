import { transaction, query, type TransactionClient } from './db';

export interface TrackerCasinoRow {
  casino_id: number;
  sort_order: number | null;
  typical_daily_sc: number | string | null;
  personal_notes: string | null;
  name: string;
  slug: string;
  streak_mode: string | null;
  reset_time_local: string | null;
  reset_timezone: string | null;
  has_streaks: boolean;
  sc_to_usd_ratio: number | string | null;
  has_affiliate_link: boolean;
  source: string;
  daily_bonus_desc: string | null;
  today_claim_id: number | null;
  today_sc: number | string | null;
  today_claimed_at: string | null;
}

export interface TrackerAlertItem {
  id: number;
  item_type: string;
  casino_id: number | null;
  title: string;
  content: string;
  expires_at: string | null;
  confirm_count: number;
  dispute_count: number;
  created_at: string;
}

export interface TrackerSuggestion {
  id: number;
  name: string;
  slug: string;
  daily_bonus_desc: string | null;
  has_affiliate_link: boolean;
  affiliate_link_url: string | null;
  tier: number;
  sc_to_usd_ratio: number | string | null;
  sort_sc: number | string | null;
}

export interface TrackerClaimHistoryRow {
  casino_id: number;
  claimed_at: string;
}

export interface TrackerStatusData {
  casinos: TrackerCasinoRow[];
  streakClaims: TrackerClaimHistoryRow[];
  alerts: TrackerAlertItem[];
}

export interface AddCasinoResult {
  casinoId: number;
  affiliateUrl: string | null;
  matchedExisting: boolean;
  createdSuggested: boolean;
  skippedDuplicate: boolean;
}

function toSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'casino';
}

async function getUniqueSlug(tx: TransactionClient, name: string) {
  const base = toSlug(name);
  const existingRows = await tx.query<{ slug: string }>(
    `SELECT slug
    FROM casinos
    WHERE slug = $1 OR slug LIKE $2`,
    [base, `${base}-%`],
  );

  const existing = new Set(existingRows.map((row) => row.slug));
  if (!existing.has(base)) {
    return base;
  }

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

async function resolveCasinoByName(
  tx: TransactionClient,
  casinoName: string,
) {
  const normalized = casinoName.trim();
  const rows = await tx.query<{
    id: number;
    name: string;
    slug: string;
    source: string;
    has_affiliate_link: boolean;
    affiliate_link_url: string | null;
  }>(
    `SELECT
      id,
      name,
      slug,
      source,
      has_affiliate_link,
      affiliate_link_url
    FROM casinos
    WHERE LOWER(name) = LOWER($1)
    ORDER BY
      CASE WHEN source = 'admin' THEN 0 ELSE 1 END,
      id ASC
    LIMIT 1`,
    [normalized],
  );

  return rows[0] ?? null;
}

async function resolveCasinoById(
  tx: TransactionClient,
  casinoId: number,
) {
  const rows = await tx.query<{
    id: number;
    name: string;
    slug: string;
    source: string;
    has_affiliate_link: boolean;
    affiliate_link_url: string | null;
  }>(
    `SELECT
      id,
      name,
      slug,
      source,
      has_affiliate_link,
      affiliate_link_url
    FROM casinos
    WHERE id = $1
    LIMIT 1`,
    [casinoId],
  );

  return rows[0] ?? null;
}

export async function getTrackerStatus(userId: string): Promise<TrackerStatusData> {
  const casinos = await query<TrackerCasinoRow>(
    `SELECT
      ucs.casino_id, ucs.sort_order, ucs.typical_daily_sc, ucs.personal_notes,
      c.name, c.slug, c.streak_mode, c.reset_time_local, c.reset_timezone,
      c.has_streaks, c.sc_to_usd_ratio, c.has_affiliate_link, c.source,
      c.daily_bonus_desc,
      dbc.id AS today_claim_id, dbc.sc_amount AS today_sc, dbc.claimed_at AS today_claimed_at
    FROM user_casino_settings ucs
    JOIN casinos c ON c.id = ucs.casino_id
    LEFT JOIN daily_bonus_claims dbc
      ON dbc.user_id = ucs.user_id
      AND dbc.casino_id = ucs.casino_id
      AND dbc.claimed_date = CURRENT_DATE
      AND dbc.claim_type = 'daily'
    WHERE ucs.user_id = $1 AND ucs.removed_at IS NULL
    ORDER BY ucs.sort_order ASC NULLS LAST`,
    [userId],
  );

  const streakOrRollingIds = casinos
    .filter(
      (casino) => casino.has_streaks || casino.streak_mode === 'rolling',
    )
    .map((casino) => casino.casino_id);

  const streakClaims =
    streakOrRollingIds.length > 0
      ? await query<TrackerClaimHistoryRow>(
          `SELECT casino_id, claimed_at
          FROM daily_bonus_claims
          WHERE user_id = $1
            AND casino_id = ANY($2::int[])
            AND claim_type = 'daily'
          ORDER BY casino_id ASC, claimed_at DESC`,
          [userId, streakOrRollingIds],
        )
      : [];

  const trackedIds = casinos.map((casino) => casino.casino_id);
  const alerts =
    trackedIds.length > 0
      ? await query<TrackerAlertItem>(
          `SELECT id, item_type, casino_id, title, content, expires_at, confirm_count, dispute_count, created_at
          FROM discord_intel_items
          WHERE is_published = true
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (casino_id = ANY($1::int[]) OR casino_id IS NULL)
          ORDER BY created_at DESC
          LIMIT 20`,
          [trackedIds],
        )
      : await query<TrackerAlertItem>(
          `SELECT id, item_type, casino_id, title, content, expires_at, confirm_count, dispute_count, created_at
          FROM discord_intel_items
          WHERE is_published = true
            AND (expires_at IS NULL OR expires_at > NOW())
            AND casino_id IS NULL
          ORDER BY created_at DESC
          LIMIT 20`,
        );

  return { casinos, streakClaims, alerts };
}

export async function getTrackerSuggestions(userId: string) {
  return query<TrackerSuggestion>(
    `SELECT c.id, c.name, c.slug, c.daily_bonus_desc, c.has_affiliate_link, c.affiliate_link_url, c.tier,
      c.sc_to_usd_ratio,
      COALESCE(agg.avg_sc, c.daily_bonus_sc_avg) AS sort_sc
    FROM casinos c
    LEFT JOIN (
      SELECT casino_id, AVG(sc_amount) FILTER (WHERE sc_amount > 0) AS avg_sc
      FROM daily_bonus_claims
      GROUP BY casino_id
    ) agg ON agg.casino_id = c.id
    WHERE c.source = 'admin'
      AND c.is_excluded = false
      AND c.id NOT IN (SELECT casino_id FROM user_casino_settings WHERE user_id = $1 AND removed_at IS NULL)
    ORDER BY sort_sc DESC NULLS LAST`,
    [userId],
  );
}

export async function addCasinoToTracker(options: {
  userId: string;
  casinoId?: number | null;
  casinoName?: string | null;
  fireAffiliate?: boolean;
  referrerSource?: string;
}): Promise<AddCasinoResult> {
  const {
    userId,
    casinoId,
    casinoName,
    fireAffiliate = false,
    referrerSource = 'tracker_suggestions',
  } = options;

  return transaction(async (tx) => {
    let casino =
      typeof casinoId === 'number' && Number.isFinite(casinoId)
        ? await resolveCasinoById(tx, casinoId)
        : null;
    let matchedExisting = Boolean(casino);
    let createdSuggested = false;

    if (!casino && casinoName) {
      casino = await resolveCasinoByName(tx, casinoName);
      matchedExisting = Boolean(casino);
    }

    if (!casino && casinoName) {
      const trimmedName = casinoName.trim();
      const slug = await getUniqueSlug(tx, trimmedName);
      const createdRows = await tx.query<{
        id: number;
        name: string;
        slug: string;
        source: string;
        has_affiliate_link: boolean;
        affiliate_link_url: string | null;
      }>(
        `INSERT INTO casinos (
          slug,
          name,
          source,
          has_affiliate_link,
          is_excluded,
          streak_mode
        ) VALUES ($1, $2, 'user_suggested', false, false, 'rolling')
        RETURNING id, name, slug, source, has_affiliate_link, affiliate_link_url`,
        [slug, trimmedName],
      );
      casino = createdRows[0];
      createdSuggested = true;
    }

    if (!casino) {
      throw new Error('Casino could not be resolved.');
    }

    const existingSettings = await tx.query<{ removed_at: string | null }>(
      `SELECT removed_at
      FROM user_casino_settings
      WHERE user_id = $1
        AND casino_id = $2
      LIMIT 1`,
      [userId, casino.id],
    );

    const alreadyActive = existingSettings[0]?.removed_at === null;
    if (!alreadyActive) {
      await tx.query(
        `INSERT INTO user_casino_settings (user_id, casino_id, added_at, removed_at)
        VALUES ($1, $2, NOW(), NULL)
        ON CONFLICT (user_id, casino_id)
        DO UPDATE SET removed_at = NULL, added_at = NOW()`,
        [userId, casino.id],
      );
    }

    let affiliateUrl: string | null = null;

    if (fireAffiliate && casino.has_affiliate_link && casino.affiliate_link_url) {
      await tx.query(
        `INSERT INTO clicks (casino_id, user_id, referrer_source)
        VALUES ($1, $2, $3)`,
        [casino.id, userId, referrerSource],
      );
      affiliateUrl = casino.affiliate_link_url;
    }

    return {
      casinoId: casino.id,
      affiliateUrl,
      matchedExisting,
      createdSuggested,
      skippedDuplicate: alreadyActive,
    };
  });
}

export async function removeCasinoFromTracker(userId: string, casinoId: number) {
  await query(
    `UPDATE user_casino_settings
    SET removed_at = NOW()
    WHERE user_id = $1
      AND casino_id = $2
      AND removed_at IS NULL`,
    [userId, casinoId],
  );
}

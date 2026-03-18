import { query, transaction } from './db';

const ACCOUNT_AGE_MATURITY_DAYS = 90;
const CLAIM_COUNT_MATURITY = 100;
const ACCOUNT_AGE_WEIGHT = 0.6;
const CLAIM_ACTIVITY_WEIGHT = 0.4;
const COMMUNITY_STANDING_OFFSET = 10;
const COMMUNITY_STANDING_DIVISOR = 20;
const PORTFOLIO_DEPOSIT_RATIO_THRESHOLD = 0.5;
const PORTFOLIO_REDEMPTION_MATURITY = 3;
const PORTFOLIO_DIVERSITY_MATURITY = 5;
const NEGATIVE_PL_SUPPRESSION_FLOOR = 0.3;
const PORTFOLIO_POSITIVE_PL_MATURITY_USD = 1000;
const PORTFOLIO_NEGATIVE_PL_DIVISOR_USD = 2000;
const CLAIM_DAYS_MATURITY = 45;
const REDEMPTION_SUCCESS_FALLBACK = 0.5;

const WEIGHT_ACCOUNT_ACTIVITY = 0.20;
const WEIGHT_SUBMISSION_HISTORY = 0.30;
const WEIGHT_COMMUNITY_STANDING = 0.15;
const WEIGHT_PORTFOLIO = 0.35;

const PORTFOLIO_PL_WEIGHT = 0.35;
const PORTFOLIO_DIVERSITY_WEIGHT = 0.25;
const PORTFOLIO_CONSISTENCY_WEIGHT = 0.25;
const PORTFOLIO_REDEMPTION_WEIGHT = 0.15;

const DEFAULT_TRUST_SCORE = 0.5;
export const TRUST_DELTA_THRESHOLD = 0.05;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeActivityScore(accountAgeDays: number, claimCount: number) {
  return (
    clamp(accountAgeDays / ACCOUNT_AGE_MATURITY_DAYS, 0, 1) * ACCOUNT_AGE_WEIGHT +
    clamp(claimCount / CLAIM_COUNT_MATURITY, 0, 1) * CLAIM_ACTIVITY_WEIGHT
  );
}

export function normalizeSubmissionScore(
  workedVotes: number,
  totalVotes: number,
) {
  return totalVotes > 0 ? workedVotes / totalVotes : 0.5;
}

export function normalizeCommunityScore(netPositiveVotes: number) {
  return clamp(
    (netPositiveVotes + COMMUNITY_STANDING_OFFSET) / COMMUNITY_STANDING_DIVISOR,
    0,
    1,
  );
}

export function normalizePortfolioScore(options: {
  netPlUsd: number;
  trackedCasinoCount: number;
  claimDays: number;
  successfulRedemptions: number;
  totalRedemptions: number;
}) {
  const {
    netPlUsd,
    trackedCasinoCount,
    claimDays,
    successfulRedemptions,
    totalRedemptions,
  } = options;

  const portfolioPl =
    netPlUsd >= 0
      ? clamp(
          netPlUsd / PORTFOLIO_POSITIVE_PL_MATURITY_USD,
          PORTFOLIO_DEPOSIT_RATIO_THRESHOLD,
          1,
        )
      : clamp(
          PORTFOLIO_DEPOSIT_RATIO_THRESHOLD +
            netPlUsd / PORTFOLIO_NEGATIVE_PL_DIVISOR_USD,
          NEGATIVE_PL_SUPPRESSION_FLOOR,
          PORTFOLIO_DEPOSIT_RATIO_THRESHOLD,
        );
  const portfolioDiversity = clamp(
    trackedCasinoCount / PORTFOLIO_DIVERSITY_MATURITY,
    0,
    1,
  );
  const portfolioConsistency = clamp(claimDays / CLAIM_DAYS_MATURITY, 0, 1);
  const redemptionSuccess =
    totalRedemptions >= PORTFOLIO_REDEMPTION_MATURITY
      ? successfulRedemptions / totalRedemptions
      : REDEMPTION_SUCCESS_FALLBACK;

  return (
    portfolioPl * PORTFOLIO_PL_WEIGHT +
    portfolioDiversity * PORTFOLIO_DIVERSITY_WEIGHT +
    portfolioConsistency * PORTFOLIO_CONSISTENCY_WEIGHT +
    redemptionSuccess * PORTFOLIO_REDEMPTION_WEIGHT
  );
}

export function combineTrustComponents(
  activity: number,
  submission: number,
  community: number,
  portfolio: number,
) {
  return clamp(
    activity * WEIGHT_ACCOUNT_ACTIVITY +
      submission * WEIGHT_SUBMISSION_HISTORY +
      community * WEIGHT_COMMUNITY_STANDING +
      portfolio * WEIGHT_PORTFOLIO,
    0,
    1,
  );
}

export function shouldWriteSnapshot(oldScore: number | null, newScore: number) {
  if (oldScore === null) return true;
  return Math.abs(newScore - oldScore) >= TRUST_DELTA_THRESHOLD;
}

export async function computeTrustScore(userId: string) {
  const [
    accountRows,
    submissionRows,
    voteRows,
    portfolioRows,
  ] = await Promise.all([
    query<{
      created_at: string | null;
      claim_count: number | string | null;
    }>(
      `SELECT
        us.created_at,
        COALESCE((SELECT COUNT(*)::int FROM daily_bonus_claims dbc WHERE dbc.user_id = us.user_id), 0) AS claim_count
      FROM user_settings us
      WHERE us.user_id = $1
      LIMIT 1`,
      [userId],
    ),
    query<{
      total_signals: number | string | null;
      worked_votes: number | string | null;
      total_votes: number | string | null;
    }>(
      `SELECT
        COUNT(*)::int AS total_signals,
        COALESCE(SUM(di.worked_count), 0) AS worked_votes,
        COALESCE(SUM(di.worked_count + di.didnt_work_count), 0) AS total_votes
      FROM discord_intel_items di
      WHERE di.submitted_by = $1
        AND di.source = 'user'`,
      [userId],
    ),
    query<{
      net_positive_votes: number | string | null;
    }>(
      `SELECT
        COALESCE(SUM(di.worked_count - di.didnt_work_count), 0) AS net_positive_votes
      FROM discord_intel_items di
      WHERE di.submitted_by = $1
        AND di.source = 'user'`,
      [userId],
    ),
    query<{
      net_pl_usd: number | string | null;
      tracked_casino_count: number | string | null;
      claim_days: number | string | null;
      successful_redemptions: number | string | null;
      total_redemptions: number | string | null;
    }>(
      `SELECT
        COALESCE((SELECT SUM(COALESCE(usd_amount, 0)) FROM ledger_entries WHERE user_id = $1), 0) AS net_pl_usd,
        COALESCE((SELECT COUNT(*)::int FROM user_casino_settings WHERE user_id = $1 AND removed_at IS NULL), 0) AS tracked_casino_count,
        COALESCE((SELECT COUNT(DISTINCT (COALESCE(reset_period_start, claimed_at))::date)::int FROM daily_bonus_claims WHERE user_id = $1), 0) AS claim_days,
        COALESCE((SELECT COUNT(*)::int FROM redemptions WHERE user_id = $1 AND status = 'received'), 0) AS successful_redemptions,
        COALESCE((SELECT COUNT(*)::int FROM redemptions WHERE user_id = $1), 0) AS total_redemptions`,
      [userId],
    ),
  ]);

  const account = accountRows[0];
  if (!account) return DEFAULT_TRUST_SCORE;

  const accountAgeDays = account.created_at
    ? Math.max(0, (Date.now() - new Date(account.created_at).getTime()) / 86_400_000)
    : 0;
  const claimCount = Number(account.claim_count ?? 0);
  const accountActivity = normalizeActivityScore(accountAgeDays, claimCount);

  const submission = submissionRows[0] ?? {
    total_signals: 0,
    worked_votes: 0,
    total_votes: 0,
  };
  const workedVotes = Number(submission.worked_votes ?? 0);
  const totalVotes = Number(submission.total_votes ?? 0);
  const submissionHistory = normalizeSubmissionScore(workedVotes, totalVotes);

  const communityStanding = normalizeCommunityScore(
    Number(voteRows[0]?.net_positive_votes ?? 0),
  );

  const portfolio = portfolioRows[0] ?? {
    net_pl_usd: 0,
    tracked_casino_count: 0,
    claim_days: 0,
    successful_redemptions: 0,
    total_redemptions: 0,
  };
  const netPlUsd = Number(portfolio.net_pl_usd ?? 0);
  const trackedCasinoCount = Number(portfolio.tracked_casino_count ?? 0);
  const claimDays = Number(portfolio.claim_days ?? 0);
  const successfulRedemptions = Number(portfolio.successful_redemptions ?? 0);
  const totalRedemptions = Number(portfolio.total_redemptions ?? 0);

  const portfolioScore = normalizePortfolioScore({
    netPlUsd,
    trackedCasinoCount,
    claimDays,
    successfulRedemptions,
    totalRedemptions,
  });

  const finalScore = combineTrustComponents(
    accountActivity,
    submissionHistory,
    communityStanding,
    portfolioScore,
  );

  await query(
    `UPDATE user_settings
    SET trust_score = $2,
        trust_score_updated_at = NOW()
    WHERE user_id = $1`,
    [userId, finalScore],
  );

  return finalScore;
}

export async function computeAllTrustScores() {
  const [
    activityRows,
    submissionRows,
    portfolioRows,
  ] = await Promise.all([
    query<{
      user_id: string;
      created_at: string | null;
      current_trust_score: number | string | null;
      claim_count: number | string | null;
    }>(
      `SELECT
        us.user_id,
        us.created_at,
        us.trust_score AS current_trust_score,
        COALESCE(dbc.claim_count, 0) AS claim_count
      FROM user_settings us
      LEFT JOIN (
        SELECT user_id, COUNT(*)::int AS claim_count
        FROM daily_bonus_claims
        GROUP BY user_id
      ) dbc ON dbc.user_id = us.user_id`,
    ),
    query<{
      user_id: string | null;
      worked_votes: number | string | null;
      total_votes: number | string | null;
      net_positive_votes: number | string | null;
    }>(
      `SELECT
        di.submitted_by AS user_id,
        COALESCE(SUM(di.worked_count), 0) AS worked_votes,
        COALESCE(SUM(di.worked_count + di.didnt_work_count), 0) AS total_votes,
        COALESCE(SUM(di.worked_count - di.didnt_work_count), 0) AS net_positive_votes
      FROM discord_intel_items di
      WHERE di.source = 'user'
      GROUP BY di.submitted_by`,
    ),
    query<{
      user_id: string;
      net_pl_usd: number | string | null;
      tracked_casino_count: number | string | null;
      claim_days: number | string | null;
      successful_redemptions: number | string | null;
      total_redemptions: number | string | null;
    }>(
      `SELECT
        us.user_id,
        COALESCE(le.net_pl, 0) AS net_pl_usd,
        COALESCE(ucs.tracked, 0) AS tracked_casino_count,
        COALESCE(dbc.claim_days, 0) AS claim_days,
        COALESCE(r_success.cnt, 0) AS successful_redemptions,
        COALESCE(r_total.cnt, 0) AS total_redemptions
      FROM user_settings us
      LEFT JOIN (
        SELECT user_id, SUM(COALESCE(usd_amount, 0)) AS net_pl
        FROM ledger_entries
        GROUP BY user_id
      ) le ON le.user_id = us.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*)::int AS tracked
        FROM user_casino_settings
        WHERE removed_at IS NULL
        GROUP BY user_id
      ) ucs ON ucs.user_id = us.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(DISTINCT (COALESCE(reset_period_start, claimed_at))::date)::int AS claim_days
        FROM daily_bonus_claims
        GROUP BY user_id
      ) dbc ON dbc.user_id = us.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*)::int AS cnt
        FROM redemptions
        WHERE status = 'received'
        GROUP BY user_id
      ) r_success ON r_success.user_id = us.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*)::int AS cnt
        FROM redemptions
        GROUP BY user_id
      ) r_total ON r_total.user_id = us.user_id`,
    ),
  ]);

  const submissionMap = new Map<string, typeof submissionRows[number]>();
  for (const row of submissionRows) {
    if (!row.user_id) continue;
    submissionMap.set(row.user_id, row);
  }

  const portfolioMap = new Map<string, typeof portfolioRows[number]>();
  for (const row of portfolioRows) {
    portfolioMap.set(row.user_id, row);
  }

  const now = Date.now();
  const results: Array<{ user_id: string; trust_score: number }> = [];
  const snapshotsToWrite: Array<{
    user_id: string;
    trust_score: number;
    activity_score: number;
    submission_score: number;
    community_score: number;
    portfolio_score: number;
  }> = [];

  for (const user of activityRows) {
    const accountAgeDays = user.created_at
      ? Math.max(0, (now - new Date(user.created_at).getTime()) / 86_400_000)
      : 0;
    const claimCount = Number(user.claim_count ?? 0);
    const activityScore = normalizeActivityScore(accountAgeDays, claimCount);

    const submission = submissionMap.get(user.user_id);
    const workedVotes = Number(submission?.worked_votes ?? 0);
    const totalVotes = Number(submission?.total_votes ?? 0);
    const submissionScore = normalizeSubmissionScore(workedVotes, totalVotes);
    const communityScore = normalizeCommunityScore(
      Number(submission?.net_positive_votes ?? 0),
    );

    const portfolio = portfolioMap.get(user.user_id);
    const portfolioScore = normalizePortfolioScore({
      netPlUsd: Number(portfolio?.net_pl_usd ?? 0),
      trackedCasinoCount: Number(portfolio?.tracked_casino_count ?? 0),
      claimDays: Number(portfolio?.claim_days ?? 0),
      successfulRedemptions: Number(portfolio?.successful_redemptions ?? 0),
      totalRedemptions: Number(portfolio?.total_redemptions ?? 0),
    });

    const finalScore = combineTrustComponents(
      activityScore,
      submissionScore,
      communityScore,
      portfolioScore,
    );
    const currentTrustScore =
      user.current_trust_score === null ? null : Number(user.current_trust_score);

    results.push({
      user_id: user.user_id,
      trust_score: finalScore,
    });

    if (shouldWriteSnapshot(currentTrustScore, finalScore)) {
      snapshotsToWrite.push({
        user_id: user.user_id,
        trust_score: finalScore,
        activity_score: activityScore,
        submission_score: submissionScore,
        community_score: communityScore,
        portfolio_score: portfolioScore,
      });
    }
  }

  await transaction(async (tx) => {
    for (const result of results) {
      await tx.query(
        `UPDATE user_settings
        SET trust_score = $2,
            trust_score_updated_at = NOW()
        WHERE user_id = $1`,
        [result.user_id, result.trust_score],
      );
    }

    if (snapshotsToWrite.length > 0) {
      const values: string[] = [];
      const params: Array<string | number> = [];

      for (const snapshot of snapshotsToWrite) {
        const offset = params.length;
        values.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`,
        );
        params.push(
          snapshot.user_id,
          snapshot.trust_score,
          snapshot.activity_score,
          snapshot.submission_score,
          snapshot.community_score,
          snapshot.portfolio_score,
        );
      }

      await tx.query(
        `INSERT INTO trust_snapshots (
          user_id,
          trust_score,
          activity_score,
          submission_score,
          community_score,
          portfolio_score
        ) VALUES ${values.join(', ')}`,
        params,
      );
    }
  });

  return results;
}

export async function evaluateContributorTier(userId: string) {
  const rows = await query<{
    current_tier: string | null;
    total_submissions: number | string | null;
    worked_ratio: number | string | null;
    account_age_days: number | string | null;
    submission_span_days: number | string | null;
    last_10_ratio: number | string | null;
    last_15_ratio: number | string | null;
  }>(
    `WITH user_signals AS (
      SELECT
        created_at,
        COALESCE(worked_count, 0) AS worked_count,
        COALESCE(didnt_work_count, 0) AS didnt_work_count
      FROM discord_intel_items
      WHERE submitted_by = $1
        AND source = 'user'
      ORDER BY created_at DESC
    ),
    last_ten AS (
      SELECT
        CASE WHEN SUM(worked_count + didnt_work_count) = 0 THEN NULL
        ELSE SUM(worked_count)::decimal / SUM(worked_count + didnt_work_count)
        END AS ratio
      FROM (SELECT * FROM user_signals LIMIT 10) q
    ),
    last_fifteen AS (
      SELECT
        CASE WHEN SUM(worked_count + didnt_work_count) = 0 THEN NULL
        ELSE SUM(worked_count)::decimal / SUM(worked_count + didnt_work_count)
        END AS ratio
      FROM (SELECT * FROM user_signals LIMIT 15) q
    )
    SELECT
      us.contributor_tier AS current_tier,
      COALESCE((SELECT COUNT(*)::int FROM user_signals), 0) AS total_submissions,
      COALESCE((
        SELECT CASE WHEN SUM(worked_count + didnt_work_count) = 0 THEN 0.0
                    ELSE SUM(worked_count)::decimal / SUM(worked_count + didnt_work_count)
               END
        FROM user_signals
      ), 0.0) AS worked_ratio,
      EXTRACT(DAY FROM NOW() - us.created_at) AS account_age_days,
      COALESCE((
        SELECT EXTRACT(DAY FROM MAX(created_at) - MIN(created_at))
        FROM user_signals
      ), 0) AS submission_span_days,
      (SELECT ratio FROM last_ten) AS last_10_ratio,
      (SELECT ratio FROM last_fifteen) AS last_15_ratio
    FROM user_settings us
    WHERE us.user_id = $1
    LIMIT 1`,
    [userId],
  );

  const row = rows[0];
  if (!row) return null;
  if (row.current_tier === 'operator') return 'operator';

  const totalSubmissions = Number(row.total_submissions ?? 0);
  const workedRatio = Number(row.worked_ratio ?? 0);
  const accountAgeDays = Number(row.account_age_days ?? 0);
  const submissionSpanDays = Number(row.submission_span_days ?? 0);
  const last10Ratio = row.last_10_ratio === null ? null : Number(row.last_10_ratio);
  const last15Ratio = row.last_15_ratio === null ? null : Number(row.last_15_ratio);

  let nextTier = 'newcomer';
  if (totalSubmissions >= 20 && workedRatio > 0.7 && submissionSpanDays >= 30) {
    nextTier = 'insider';
  } else if (totalSubmissions >= 5 && workedRatio > 0.6 && accountAgeDays >= 14) {
    nextTier = 'scout';
  }

  if (row.current_tier === 'insider' && last15Ratio !== null && last15Ratio < 0.5) {
    nextTier = 'scout';
  }
  if (row.current_tier === 'scout' && last10Ratio !== null && last10Ratio < 0.4) {
    nextTier = 'newcomer';
  }

  await query(
    `UPDATE user_settings
    SET contributor_tier = $2
    WHERE user_id = $1`,
    [userId, nextTier],
  );

  return nextTier;
}

export async function evaluateAllContributorTiers() {
  const users = await query<{
    user_id: string;
    current_tier: string | null;
    total_submissions: number | string | null;
    worked_ratio: number | string | null;
    account_age_days: number | string | null;
    submission_span_days: number | string | null;
    last_10_ratio: number | string | null;
    last_15_ratio: number | string | null;
  }>(
    `WITH user_signals AS (
      SELECT
        submitted_by,
        created_at,
        COALESCE(worked_count, 0) AS worked_count,
        COALESCE(didnt_work_count, 0) AS didnt_work_count,
        ROW_NUMBER() OVER (PARTITION BY submitted_by ORDER BY created_at DESC) AS rn
      FROM discord_intel_items
      WHERE source = 'user'
    ),
    submission_stats AS (
      SELECT
        submitted_by,
        COUNT(*) AS total_submissions,
        CASE WHEN SUM(COALESCE(worked_count,0) + COALESCE(didnt_work_count,0)) = 0 THEN 0.0
             ELSE SUM(COALESCE(worked_count,0))::decimal / SUM(COALESCE(worked_count,0) + COALESCE(didnt_work_count,0))
        END AS worked_ratio,
        MAX(created_at) - MIN(created_at) AS submission_span
      FROM discord_intel_items
      WHERE source = 'user'
      GROUP BY submitted_by
    ),
    last_ten AS (
      SELECT
        submitted_by,
        CASE WHEN SUM(COALESCE(worked_count,0) + COALESCE(didnt_work_count,0)) = 0 THEN NULL
             ELSE SUM(COALESCE(worked_count,0))::decimal / SUM(COALESCE(worked_count,0) + COALESCE(didnt_work_count,0))
        END AS ratio
      FROM user_signals
      WHERE rn <= 10
      GROUP BY submitted_by
    ),
    last_fifteen AS (
      SELECT
        submitted_by,
        CASE WHEN SUM(COALESCE(worked_count,0) + COALESCE(didnt_work_count,0)) = 0 THEN NULL
             ELSE SUM(COALESCE(worked_count,0))::decimal / SUM(COALESCE(worked_count,0) + COALESCE(didnt_work_count,0))
        END AS ratio
      FROM user_signals
      WHERE rn <= 15
      GROUP BY submitted_by
    )
    SELECT
      us.user_id,
      us.contributor_tier AS current_tier,
      COALESCE(ss.total_submissions, 0) AS total_submissions,
      COALESCE(ss.worked_ratio, 0) AS worked_ratio,
      COALESCE(EXTRACT(DAY FROM NOW() - us.created_at), 0) AS account_age_days,
      COALESCE(EXTRACT(DAY FROM ss.submission_span), 0) AS submission_span_days,
      lt.ratio AS last_10_ratio,
      lf.ratio AS last_15_ratio
    FROM user_settings us
    LEFT JOIN submission_stats ss ON ss.submitted_by = us.user_id
    LEFT JOIN last_ten lt ON lt.submitted_by = us.user_id
    LEFT JOIN last_fifteen lf ON lf.submitted_by = us.user_id`,
  );

  const results: Array<{ user_id: string; contributor_tier: string | null }> = [];
  const updates: Array<{ user_id: string; contributor_tier: string }> = [];

  for (const user of users) {
    if (user.current_tier === 'operator') {
      results.push({
        user_id: user.user_id,
        contributor_tier: 'operator',
      });
      continue;
    }

    const totalSubmissions = Number(user.total_submissions ?? 0);
    const workedRatio = Number(user.worked_ratio ?? 0);
    const accountAgeDays = Number(user.account_age_days ?? 0);
    const submissionSpanDays = Number(user.submission_span_days ?? 0);
    const last10Ratio = user.last_10_ratio === null ? null : Number(user.last_10_ratio);
    const last15Ratio = user.last_15_ratio === null ? null : Number(user.last_15_ratio);

    // NOTE: tier logic duplicated from evaluateContributorTier() -- unify in v2.
    let nextTier = 'newcomer';
    if (totalSubmissions >= 20 && workedRatio > 0.7 && submissionSpanDays >= 30) {
      nextTier = 'insider';
    } else if (totalSubmissions >= 5 && workedRatio > 0.6 && accountAgeDays >= 14) {
      nextTier = 'scout';
    }

    if (user.current_tier === 'insider' && last15Ratio !== null && last15Ratio < 0.5) {
      nextTier = 'scout';
    }
    if (user.current_tier === 'scout' && last10Ratio !== null && last10Ratio < 0.4) {
      nextTier = 'newcomer';
    }

    results.push({
      user_id: user.user_id,
      contributor_tier: nextTier,
    });

    if (nextTier !== user.current_tier) {
      updates.push({
        user_id: user.user_id,
        contributor_tier: nextTier,
      });
    }
  }

  await transaction(async (tx) => {
    for (const update of updates) {
      await tx.query(
        `UPDATE user_settings
        SET contributor_tier = $2
        WHERE user_id = $1`,
        [update.user_id, update.contributor_tier],
      );
    }
  });

  return results;
}

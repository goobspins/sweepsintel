import { query } from './db';

const WEIGHT_ACCOUNT_ACTIVITY = 0.2;
const WEIGHT_SUBMISSION_HISTORY = 0.3;
const WEIGHT_COMMUNITY_STANDING = 0.15;
const WEIGHT_PORTFOLIO = 0.35;

const PORTFOLIO_FLOOR = 0.2;
const DEFAULT_TRUST_SCORE = 0.5;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
  const accountActivity = clamp(accountAgeDays / 90, 0, 1) * 0.6 + clamp(claimCount / 100, 0, 1) * 0.4;

  const submission = submissionRows[0] ?? {
    total_signals: 0,
    worked_votes: 0,
    total_votes: 0,
  };
  const workedVotes = Number(submission.worked_votes ?? 0);
  const totalVotes = Number(submission.total_votes ?? 0);
  const submissionHistory = totalVotes > 0 ? workedVotes / totalVotes : 0.5;

  const communityStanding = clamp((Number(voteRows[0]?.net_positive_votes ?? 0) + 10) / 20, 0, 1);

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

  const portfolioPl = netPlUsd >= 0 ? clamp(netPlUsd / 1000, 0.5, 1) : clamp(0.5 + netPlUsd / 2000, PORTFOLIO_FLOOR, 0.5);
  const portfolioDiversity = clamp(trackedCasinoCount / 15, 0, 1);
  const portfolioConsistency = clamp(claimDays / 45, 0, 1);
  const redemptionSuccess = totalRedemptions > 0 ? successfulRedemptions / totalRedemptions : 0.5;
  const portfolioScore = portfolioPl * 0.35 + portfolioDiversity * 0.25 + portfolioConsistency * 0.25 + redemptionSuccess * 0.15;

  const score =
    accountActivity * WEIGHT_ACCOUNT_ACTIVITY +
    submissionHistory * WEIGHT_SUBMISSION_HISTORY +
    communityStanding * WEIGHT_COMMUNITY_STANDING +
    portfolioScore * WEIGHT_PORTFOLIO;

  const finalScore = clamp(score, 0, 1);

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
  const users = await query<{ user_id: string }>(
    `SELECT user_id
    FROM user_settings`,
  );
  const results = [];
  for (const user of users) {
    results.push({
      user_id: user.user_id,
      trust_score: await computeTrustScore(user.user_id),
    });
  }
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
  const users = await query<{ user_id: string }>(
    `SELECT DISTINCT user_id
    FROM user_settings`,
  );
  const results = [];
  for (const user of users) {
    results.push({
      user_id: user.user_id,
      contributor_tier: await evaluateContributorTier(user.user_id),
    });
  }
  return results;
}

import { DateTime } from 'luxon';

import { getCached } from './cache';
import { query, transaction } from './db';

const WARNING_WEIGHT_ACTIVE = 1;
const WARNING_WEIGHT_24H = 0.75;
const WARNING_WEIGHT_48H = 0.5;
const WARNING_WEIGHT_72H = 0.25;

const HEALTH_THRESHOLD_WATCH = 1.5;
const HEALTH_THRESHOLD_AT_RISK = 3;
const HEALTH_THRESHOLD_CRITICAL = 5;

const PERSONAL_ESCALATE_PENDING_COUNT = 1;
const PERSONAL_ESCALATE_EXPOSURE_SC = 250;

export type HealthStatus = 'healthy' | 'watch' | 'at_risk' | 'critical';

export type CasinoHealthRow = {
  casino_id: number;
  global_status: HealthStatus;
  status_reason: string | null;
  active_warning_count: number;
  redemption_trend: number | null;
  last_computed_at: string | null;
  admin_override_status: HealthStatus | null;
  admin_override_reason: string | null;
  admin_override_at: string | null;
};

export type CasinoHealthForUser = CasinoHealthRow & {
  personal_status: HealthStatus;
  pending_redemptions_count: number;
  pending_redemptions_usd: number;
  sc_exposure: number;
  exposure_reason: string | null;
  warning_signals: Array<{
    id: number;
    title: string;
    content: string;
    created_at: string;
    expires_at: string | null;
    worked_count: number;
    didnt_work_count: number;
    signal_status: string;
  }>;
};

export function computeWarningDecayWeight(warningAgeHours: number) {
  if (!Number.isFinite(warningAgeHours) || warningAgeHours <= 0) return WARNING_WEIGHT_ACTIVE;
  if (warningAgeHours <= 24) return WARNING_WEIGHT_24H;
  if (warningAgeHours <= 48) return WARNING_WEIGHT_48H;
  if (warningAgeHours <= 72) return WARNING_WEIGHT_72H;
  return 0;
}

export function computeDisputeFactor(workedCount: number, didntWorkCount: number) {
  const totalVotes = workedCount + didntWorkCount;
  if (totalVotes < 3) return 1;
  return Math.max(0.35, 1 - didntWorkCount / Math.max(1, totalVotes));
}

export function computeRedemptionTrendScore(avg7d: number, avg30d: number) {
  if (!Number.isFinite(avg7d) || !Number.isFinite(avg30d) || avg7d <= 0 || avg30d <= 0) return 0;
  const trendRatio = avg7d / avg30d;
  if (trendRatio >= 2) return 2;
  if (trendRatio >= 1.5) return 1;
  return 0;
}

export function mapScoreToHealthStatus(compositeScore: number): HealthStatus {
  if (compositeScore >= HEALTH_THRESHOLD_CRITICAL) return 'critical';
  if (compositeScore >= HEALTH_THRESHOLD_AT_RISK) return 'at_risk';
  if (compositeScore >= HEALTH_THRESHOLD_WATCH) return 'watch';
  return 'healthy';
}

export function computePersonalEscalation(
  baseStatus: HealthStatus,
  pendingRedemptions: number,
  scExposure: number,
): HealthStatus {
  if (
    pendingRedemptions < PERSONAL_ESCALATE_PENDING_COUNT
    && scExposure < PERSONAL_ESCALATE_EXPOSURE_SC
  ) {
    return baseStatus;
  }
  if (baseStatus === 'healthy') return 'watch';
  if (baseStatus === 'watch') return 'at_risk';
  return 'critical';
}

function decayWeight(expiresAt: string | null) {
  if (!expiresAt) return WARNING_WEIGHT_ACTIVE;
  const expiry = DateTime.fromISO(expiresAt);
  if (!expiry.isValid) return WARNING_WEIGHT_ACTIVE;
  const hoursAgo = DateTime.now().diff(expiry, 'hours').hours;
  return computeWarningDecayWeight(hoursAgo);
}

function trendScoreFromRatio(trendRatio: number | null) {
  if (trendRatio === null || !Number.isFinite(trendRatio) || trendRatio <= 0) return 0;
  return computeRedemptionTrendScore(trendRatio, 1);
}

function clampStatus(score: number): HealthStatus {
  return mapScoreToHealthStatus(score);
}

function escalateStatus(current: HealthStatus): HealthStatus {
  return computePersonalEscalation(current, PERSONAL_ESCALATE_PENDING_COUNT, PERSONAL_ESCALATE_EXPOSURE_SC);
}

export async function computeAllCasinoHealth() {
  const warnings = await query<{
    casino_id: number | null;
    title: string;
    expires_at: string | null;
    worked_count: number | string | null;
    didnt_work_count: number | string | null;
    signal_status: string | null;
    created_at: string;
  }>(
    `SELECT
      casino_id,
      title,
      expires_at,
      worked_count,
      didnt_work_count,
      signal_status,
      created_at
    FROM discord_intel_items
    WHERE is_published = true
      AND item_type = 'platform_warning'
      AND casino_id IS NOT NULL`,
  );

  const redemptionTrendRows = await query<{
    casino_id: number;
    trend_ratio: number | string | null;
  }>(
    `WITH recent AS (
      SELECT casino_id, AVG(EXTRACT(EPOCH FROM (confirmed_at - submitted_at)) / 86400.0) AS avg_days
      FROM redemptions
      WHERE status = 'received'
        AND confirmed_at > NOW() - INTERVAL '7 days'
      GROUP BY casino_id
    ),
    baseline AS (
      SELECT casino_id, AVG(EXTRACT(EPOCH FROM (confirmed_at - submitted_at)) / 86400.0) AS avg_days
      FROM redemptions
      WHERE status = 'received'
        AND confirmed_at > NOW() - INTERVAL '30 days'
      GROUP BY casino_id
    )
    SELECT
      COALESCE(recent.casino_id, baseline.casino_id) AS casino_id,
      CASE
        WHEN baseline.avg_days IS NULL OR baseline.avg_days = 0 OR recent.avg_days IS NULL THEN NULL
        ELSE recent.avg_days / baseline.avg_days
      END AS trend_ratio
    FROM recent
    FULL OUTER JOIN baseline ON baseline.casino_id = recent.casino_id`,
  );

  const allCasinoRows = await query<{ id: number }>('SELECT id FROM casinos');
  const warningMap = new Map<number, typeof warnings>();
  for (const warning of warnings) {
    if (warning.casino_id === null) continue;
    const current = warningMap.get(warning.casino_id) ?? [];
    current.push(warning);
    warningMap.set(warning.casino_id, current);
  }
  const trendMap = new Map<number, number | null>();
  for (const row of redemptionTrendRows) {
    trendMap.set(row.casino_id, row.trend_ratio === null ? null : Number(row.trend_ratio));
  }

  await transaction(async (tx) => {
    for (const casino of allCasinoRows) {
      const casinoWarnings = warningMap.get(casino.id) ?? [];
      let weightedWarnings = 0;
      let activeWarningCount = 0;

      for (const warning of casinoWarnings) {
        const weight = decayWeight(warning.expires_at);
        if (weight <= 0) continue;
        const worked = Number(warning.worked_count ?? 0);
        const didntWork = Number(warning.didnt_work_count ?? 0);
        const disputeFactor = computeDisputeFactor(worked, didntWork);
        weightedWarnings += weight * disputeFactor;
        activeWarningCount += 1;
      }

      const redemptionTrend = trendMap.get(casino.id) ?? null;
      let score = weightedWarnings;
      score += trendScoreFromRatio(redemptionTrend);

      const computedStatus = clampStatus(score);
      const reasonParts: string[] = [];
      if (activeWarningCount > 0) {
        reasonParts.push(`${activeWarningCount} warning signal${activeWarningCount === 1 ? '' : 's'}`);
      }
      if (redemptionTrend !== null && redemptionTrend >= 1.5) {
        reasonParts.push(`redemptions trending ${redemptionTrend.toFixed(2)}x slower`);
      }

      await tx.query(
        `INSERT INTO casino_health (
          casino_id,
          global_status,
          status_reason,
          active_warning_count,
          redemption_trend,
          last_computed_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (casino_id)
        DO UPDATE SET
          global_status = EXCLUDED.global_status,
          status_reason = EXCLUDED.status_reason,
          active_warning_count = EXCLUDED.active_warning_count,
          redemption_trend = EXCLUDED.redemption_trend,
          last_computed_at = NOW()`,
        [
          casino.id,
          computedStatus,
          reasonParts.length > 0 ? reasonParts.join(' · ') : 'No active warnings detected.',
          activeWarningCount,
          redemptionTrend,
        ],
      );
    }
  });
}

export async function getCasinoHealth(casinoId: number) {
  const rows = await query<CasinoHealthRow>(
    `SELECT
      casino_id,
      global_status,
      status_reason,
      active_warning_count,
      redemption_trend,
      last_computed_at,
      admin_override_status,
      admin_override_reason,
      admin_override_at
    FROM casino_health
    WHERE casino_id = $1
    LIMIT 1`,
    [casinoId],
  );
  return rows[0] ?? null;
}

export async function getCasinoHealthForUser(casinoId: number, userId: string): Promise<CasinoHealthForUser | null> {
  const [baseHealth, exposureRows, warningSignals] = await Promise.all([
    getCasinoHealth(casinoId),
    query<{
      pending_redemptions_count: number | string | null;
      pending_redemptions_usd: number | string | null;
      sc_exposure: number | string | null;
    }>(
      `SELECT
        COALESCE(COUNT(*) FILTER (WHERE r.status = 'pending'), 0)::int AS pending_redemptions_count,
        COALESCE(SUM(r.usd_amount) FILTER (WHERE r.status = 'pending'), 0) AS pending_redemptions_usd,
        COALESCE(SUM(CASE WHEN le.entry_type IN ('daily', 'free_sc', 'purchase_credit', 'adjustment') THEN COALESCE(le.sc_amount, 0) ELSE 0 END), 0) AS sc_exposure
      FROM user_casino_settings ucs
      LEFT JOIN redemptions r
        ON r.user_id = ucs.user_id
        AND r.casino_id = ucs.casino_id
      LEFT JOIN ledger_entries le
        ON le.user_id = ucs.user_id
        AND le.casino_id = ucs.casino_id
      WHERE ucs.user_id = $1
        AND ucs.casino_id = $2
        AND ucs.removed_at IS NULL
      GROUP BY ucs.casino_id`,
      [userId, casinoId],
    ),
    query<{
      id: number;
      title: string;
      content: string;
      created_at: string;
      expires_at: string | null;
      worked_count: number | string | null;
      didnt_work_count: number | string | null;
      signal_status: string | null;
    }>(
      `SELECT
        id,
        title,
        content,
        created_at,
        expires_at,
        worked_count,
        didnt_work_count,
        signal_status
      FROM discord_intel_items
      WHERE casino_id = $1
        AND is_published = true
        AND item_type = 'platform_warning'
      ORDER BY created_at DESC
      LIMIT 6`,
      [casinoId],
    ),
  ]);

  if (!baseHealth) return null;

  const exposure = exposureRows[0] ?? {
    pending_redemptions_count: 0,
    pending_redemptions_usd: 0,
    sc_exposure: 0,
  };
  const pendingCount = Number(exposure.pending_redemptions_count ?? 0);
  const pendingUsd = Number(exposure.pending_redemptions_usd ?? 0);
  const scExposure = Number(exposure.sc_exposure ?? 0);

  const baseStatus = (baseHealth.admin_override_status ?? baseHealth.global_status) as HealthStatus;
  let personalStatus = baseStatus;
  let exposureReason: string | null = null;

  if (pendingCount >= PERSONAL_ESCALATE_PENDING_COUNT || scExposure >= PERSONAL_ESCALATE_EXPOSURE_SC) {
    personalStatus = computePersonalEscalation(baseStatus, pendingCount, scExposure);
    exposureReason =
      pendingCount >= PERSONAL_ESCALATE_PENDING_COUNT
        ? `You have ${pendingCount} pending redemption${pendingCount === 1 ? '' : 's'} here.`
        : `You have ${scExposure.toFixed(2)} SC exposed here.`;
  }

  return {
    ...baseHealth,
    personal_status: personalStatus,
    pending_redemptions_count: pendingCount,
    pending_redemptions_usd: pendingUsd,
    sc_exposure: scExposure,
    exposure_reason: exposureReason,
    warning_signals: warningSignals.map((signal) => ({
      ...signal,
      worked_count: Number(signal.worked_count ?? 0),
      didnt_work_count: Number(signal.didnt_work_count ?? 0),
      signal_status: signal.signal_status ?? 'active',
    })),
  };
}

export async function getHealthForTrackedCasinos(userId: string) {
  return getCached(`tracked-health:${userId}`, 5 * 60 * 1000, async () => {
    const casinoRows = await query<{ casino_id: number }>(
      `SELECT casino_id
      FROM user_casino_settings
      WHERE user_id = $1
        AND removed_at IS NULL`,
      [userId],
    );

    const details = await Promise.all(
      casinoRows.map((row) => getCasinoHealthForUser(row.casino_id, userId)),
    );

    return details.filter((item): item is CasinoHealthForUser => Boolean(item));
  });
}

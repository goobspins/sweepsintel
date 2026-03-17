import { getCached } from './cache';
import { query } from './db';

const REDEMPTION_STATS_TTL_MS = 60 * 60 * 1000;

interface RedemptionTimingRow {
  days: number | string;
  confirmed_at: string;
  submitted_at: string;
}

export interface RedemptionStats {
  medianDays: number | null;
  p80Days: number | null;
  sampleCount: number;
  trendWarning: boolean;
}

export async function getRedemptionStats(
  casinoId: number,
): Promise<RedemptionStats> {
  const statsMap = await getRedemptionStatsForCasinos([casinoId]);
  return statsMap.get(casinoId) ?? {
    medianDays: null,
    p80Days: null,
    sampleCount: 0,
    trendWarning: false,
  };
}

export async function getRedemptionStatsForCasinos(casinoIds: number[]) {
  const validIds = Array.from(new Set(casinoIds.filter((casinoId) => Number.isFinite(casinoId))));
  const results = new Map<number, RedemptionStats>();

  await Promise.all(
    validIds.map(async (casinoId) => {
      const stats = await getCached(
        `redemption-stats:${casinoId}`,
        REDEMPTION_STATS_TTL_MS,
        async () => {
          const rows = await query<RedemptionTimingRow>(
            `SELECT
              EXTRACT(EPOCH FROM (confirmed_at - submitted_at)) / 86400.0 AS days,
              confirmed_at,
              submitted_at
            FROM redemptions
            WHERE casino_id = $1
              AND status = 'received'
              AND confirmed_at IS NOT NULL
            ORDER BY confirmed_at DESC
            LIMIT 1200`,
            [casinoId],
          );

          return computeStats(rows);
        },
      );

      results.set(casinoId, stats);
    }),
  );

  return results;
}

function computeStats(rows: RedemptionTimingRow[]): RedemptionStats {
  const allDays = rows
    .map((row) => Number(row.days))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (allDays.length < 5) {
    return {
      medianDays: null,
      p80Days: null,
      sampleCount: allDays.length,
      trendWarning: false,
    };
  }

  const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const priorCutoff = recentCutoff - 30 * 24 * 60 * 60 * 1000;

  const recent = rows
    .filter((row) => new Date(row.confirmed_at).getTime() >= recentCutoff)
    .map((row) => Number(row.days))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const prior = rows
    .filter((row) => {
      const confirmedAt = new Date(row.confirmed_at).getTime();
      return confirmedAt < recentCutoff && confirmedAt >= priorCutoff;
    })
    .map((row) => Number(row.days))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  const recentMedian = median(recent);
  const priorMedian = median(prior);

  return {
    medianDays: roundOne(median(allDays)),
    p80Days: roundOne(percentile(allDays, 0.8)),
    sampleCount: allDays.length,
    trendWarning:
      recentMedian !== null &&
      priorMedian !== null &&
      recentMedian > priorMedian * 1.2,
  };
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const middle = Math.floor(values.length / 2);

  if (values.length % 2 === 0) {
    return (values[middle - 1] + values[middle]) / 2;
  }

  return values[middle];
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) {
    return null;
  }

  const index = Math.ceil(values.length * fraction) - 1;
  return values[Math.max(0, Math.min(values.length - 1, index))];
}

function roundOne(value: number | null) {
  if (value === null) {
    return null;
  }

  return Math.round(value * 10) / 10;
}


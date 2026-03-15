import type { RedemptionStats } from '../../lib/redemption-stats';

interface RedemptionTimeStatsProps {
  stats: RedemptionStats;
}

export default function RedemptionTimeStats({
  stats,
}: RedemptionTimeStatsProps) {
  if (stats.sampleCount < 5 || stats.medianDays === null || stats.p80Days === null) {
    return (
      <p style={{ margin: 0, color: 'var(--color-muted)' }}>
        Insufficient data - be the first to log a redemption.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <strong>Median: {stats.medianDays} days</strong>
        <strong>80th percentile: {stats.p80Days} days</strong>
      </div>
      <p style={{ margin: 0, color: 'var(--color-muted)' }}>
        Based on {stats.sampleCount} community redemptions.
      </p>
      {stats.trendWarning ? (
        <p style={{ margin: 0, color: 'var(--accent-yellow)', fontWeight: 700 }}>
          Processing times appear to be increasing recently.
        </p>
      ) : null}
    </div>
  );
}


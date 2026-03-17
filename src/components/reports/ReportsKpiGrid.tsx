import { formatCurrency } from '../../lib/format';
import { DEFAULT_KPI_CARDS, type KpiCardId, type ReportsSummary } from './types';

interface ReportsKpiGridProps {
  summary: ReportsSummary;
}

export default function ReportsKpiGrid({ summary }: ReportsKpiGridProps) {
  const cards = (summary.kpiCards.length >= 3 ? summary.kpiCards : DEFAULT_KPI_CARDS).map((id) => buildKpiCard(id, summary));
  return (
    <section className="kpi-grid" aria-label="Report KPI cards">
      {cards.map((card) => (
        <article key={card.id} className="surface-card kpi-card">
          <span className="kpi-label">{card.label}</span>
          <strong className={`kpi-value ${card.toneClassName ?? ''}`}>{card.value}</strong>
          {card.subvalue ? <span className={`kpi-subvalue ${card.subtoneClassName ?? ''}`}>{card.subvalue}</span> : null}
        </article>
      ))}
      <style>{`
        .kpi-grid { display:grid; gap:1rem; grid-template-columns:repeat(4, minmax(0, 1fr)); }
        .kpi-card { padding:1.4rem; display:grid; gap:.55rem; min-height:132px; align-content:start; }
        .kpi-label { color:var(--text-muted); font-size:.78rem; letter-spacing:.08em; text-transform:uppercase; font-weight:800; }
        .kpi-value { color:var(--text-primary); font-size:2rem; letter-spacing:-.04em; font-weight:800; }
        .kpi-subvalue { color:var(--text-secondary); font-size:1rem; font-weight:700; }
        .kpi-positive { color:var(--accent-green); }
        .kpi-pending { color:var(--accent-yellow); }
        .kpi-negative { color:var(--accent-red); }
        @media (max-width: 1100px) { .kpi-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 720px) { .kpi-grid { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}

function buildKpiCard(cardId: KpiCardId, summary: ReportsSummary) {
  if (cardId === 'sc_earned') {
    return { id: cardId, label: 'SC Earned Today', value: summary.scEarnedToday.toFixed(2), subvalue: null, toneClassName: 'kpi-positive', subtoneClassName: null };
  }
  if (cardId === 'usd_earned') {
    return { id: cardId, label: 'USD Earned Today', value: formatCurrency(summary.usdEarnedToday), subvalue: null, toneClassName: 'kpi-positive', subtoneClassName: null };
  }
  if (cardId === 'purchases') {
    return { id: cardId, label: 'Purchases', value: String(summary.purchaseCountToday), subvalue: formatCurrency(summary.purchaseUsdToday), toneClassName: null, subtoneClassName: null };
  }
  if (cardId === 'pending_redemptions') {
    return { id: cardId, label: 'Pending Redemptions', value: String(summary.pendingRedemptionsCount), subvalue: formatCurrency(summary.pendingRedemptionsUsd), toneClassName: 'kpi-pending', subtoneClassName: 'kpi-pending' };
  }
  if (cardId === 'best_performer') {
    return {
      id: cardId,
      label: 'Best Performer',
      value: summary.bestPerformerName ?? 'No data yet',
      subvalue: `${summary.bestPerformerSc >= 0 ? '+' : ''}${summary.bestPerformerSc.toFixed(2)} SC`,
      toneClassName: summary.bestPerformerSc >= 0 ? 'kpi-positive' : 'kpi-negative',
      subtoneClassName: summary.bestPerformerSc >= 0 ? 'kpi-positive' : 'kpi-negative',
    };
  }
  if (cardId === 'claim_streak') {
    return {
      id: cardId,
      label: 'Claim Streak',
      value: `${summary.claimStreakDays} day${summary.claimStreakDays === 1 ? '' : 's'}`,
      subvalue: summary.claimStreakDays > 0 ? 'Consecutive full days' : 'Start a full-day streak',
      toneClassName: summary.claimStreakDays > 0 ? 'kpi-positive' : null,
      subtoneClassName: null,
    };
  }
  return {
    id: cardId,
    label: 'Daily Velocity',
    value: `${summary.dailyVelocityPct >= 0 ? '+' : ''}${Math.round(summary.dailyVelocityPct)}%`,
    subvalue: 'vs 30-day daily average',
    toneClassName: summary.dailyVelocityPct >= 0 ? 'kpi-positive' : 'kpi-negative',
    subtoneClassName: null,
  };
}

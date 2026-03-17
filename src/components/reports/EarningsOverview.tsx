import { formatCurrency, formatCurrencySigned, formatNumber } from '../../lib/format';
import type { ReportsSummary } from './types';

interface EarningsOverviewProps {
  summary: ReportsSummary;
}

export default function EarningsOverview({ summary }: EarningsOverviewProps) {
  return (
    <section className="surface-card overview-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">Earnings Overview</div>
          <h2 className="section-title overview-title">Performance summary</h2>
        </div>
      </div>
      <div className="overview-grid">
        <article className="overview-item"><span className="overview-label">Total SC Earned</span><strong className="overview-value">{formatNumber(summary.totalSc)}</strong></article>
        <article className="overview-item"><span className="overview-label">Total USD Invested</span><strong className="overview-value">{formatCurrency(summary.totalInvestedUsd)}</strong></article>
        <article className="overview-item"><span className="overview-label">Total USD Redeemed</span><strong className="overview-value">{formatCurrency(summary.totalRedeemedUsd)}</strong></article>
        <article className="overview-item"><span className="overview-label">Net P/L</span><strong className={`overview-value ${summary.netPlUsd >= 0 ? 'positive' : 'negative'}`}>{formatCurrencySigned(summary.netPlUsd)}</strong></article>
      </div>
      <style>{`
        .overview-card { padding:1.25rem 1.35rem; }
        .overview-title { margin:.2rem 0 0; }
        .section-head { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; flex-wrap:wrap; margin-bottom:1rem; }
        .overview-grid { display:grid; gap:1rem; grid-template-columns:repeat(4, minmax(0, 1fr)); }
        .overview-item { display:grid; gap:.45rem; padding:1rem; border-radius:1rem; border:1px solid var(--color-border); background:rgba(17, 24, 39, 0.4); }
        .overview-label { color:var(--text-muted); font-size:.78rem; letter-spacing:.08em; text-transform:uppercase; font-weight:800; }
        .overview-value { color:var(--text-primary); font-size:1.7rem; font-weight:800; letter-spacing:-.04em; }
        .positive { color:var(--accent-green); }
        .negative { color:var(--accent-red); }
        @media (max-width: 1100px) { .overview-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 720px) { .overview-grid { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}

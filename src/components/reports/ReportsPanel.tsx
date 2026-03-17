import { useMemo, useState } from 'react';

import {
  formatCurrency,
  formatCurrencySigned,
  formatDateTime,
  formatDateTimeCompact,
  formatEntryType,
  formatNumber,
  formatSignedNumber,
  getTierBadgeStyle,
} from '../../lib/format';

type KpiCardId =
  | 'sc_earned'
  | 'usd_earned'
  | 'purchases'
  | 'pending_redemptions'
  | 'best_performer'
  | 'claim_streak'
  | 'daily_velocity';

type ReportsSummary = {
  kpiCards: KpiCardId[];
  scEarnedToday: number;
  usdEarnedToday: number;
  purchaseCountToday: number;
  purchaseUsdToday: number;
  pendingRedemptionsCount: number;
  pendingRedemptionsUsd: number;
  bestPerformerName: string | null;
  bestPerformerSc: number;
  claimStreakDays: number;
  dailyVelocityPct: number;
  totalSc: number;
  totalInvestedUsd: number;
  totalRedeemedUsd: number;
  netPlUsd: number;
};

type ReportCasinoRow = {
  casinoId: number;
  name: string;
  slug: string;
  tier: string | null;
  scBalance: number;
  usdInvested: number;
  usdRedeemed: number;
  netPlUsd: number;
  lastActivityAt: string | null;
};

type RecentActivityRow = {
  id: number;
  casinoName: string;
  casinoSlug: string;
  entryType: string;
  scAmount: number | null;
  usdAmount: number | null;
  notes: string | null;
  entryAt: string | null;
};

type ReportsPanelProps = {
  initialSummary: ReportsSummary;
  initialCasinos: ReportCasinoRow[];
  initialRecentActivity: RecentActivityRow[];
};

type SortKey = 'name' | 'scBalance' | 'usdInvested' | 'usdRedeemed' | 'netPlUsd' | 'lastActivityAt';

const DEFAULT_KPI_CARDS: KpiCardId[] = ['sc_earned', 'usd_earned', 'purchases', 'pending_redemptions'];

export default function ReportsPanel({
  initialSummary,
  initialCasinos,
  initialRecentActivity,
}: ReportsPanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>('netPlUsd');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const kpiCards = useMemo(
    () => (initialSummary.kpiCards.length >= 3 ? initialSummary.kpiCards : DEFAULT_KPI_CARDS).map((id) => buildKpiCard(id, initialSummary)),
    [initialSummary],
  );

  const casinoRows = useMemo(() => {
    const nextRows = [...initialCasinos];
    nextRows.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name) * direction;
      }
      if (sortKey === 'lastActivityAt') {
        return ((new Date(a.lastActivityAt ?? 0).getTime()) - (new Date(b.lastActivityAt ?? 0).getTime())) * direction;
      }
      return ((a[sortKey] as number) - (b[sortKey] as number)) * direction;
    });
    return nextRows;
  }, [initialCasinos, sortDirection, sortKey]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'name' ? 'asc' : 'desc');
  }

  return (
    <div className="reports-shell">
      <section className="surface-card reports-hero">
        <div className="eyebrow">Reports</div>
        <h1 className="section-title reports-title">Reports</h1>
        <p className="muted reports-subtitle">Your performance at a glance</p>
      </section>

      <section className="kpi-grid" aria-label="Report KPI cards">
        {kpiCards.map((card) => (
          <article key={card.id} className="surface-card kpi-card">
            <span className="kpi-label">{card.label}</span>
            <strong className={`kpi-value ${card.toneClassName ?? ''}`}>{card.value}</strong>
            {card.subvalue ? <span className={`kpi-subvalue ${card.subtoneClassName ?? ''}`}>{card.subvalue}</span> : null}
          </article>
        ))}
      </section>

      <section className="surface-card overview-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">Earnings Overview</div>
            <h2 className="section-title overview-title">Performance summary</h2>
          </div>
        </div>
        <div className="overview-grid">
          <article className="overview-item">
            <span className="overview-label">Total SC Earned</span>
            <strong className="overview-value">{formatNumber(initialSummary.totalSc)}</strong>
          </article>
          <article className="overview-item">
            <span className="overview-label">Total USD Invested</span>
            <strong className="overview-value">{formatCurrency(initialSummary.totalInvestedUsd)}</strong>
          </article>
          <article className="overview-item">
            <span className="overview-label">Total USD Redeemed</span>
            <strong className="overview-value">{formatCurrency(initialSummary.totalRedeemedUsd)}</strong>
          </article>
          <article className="overview-item">
            <span className="overview-label">Net P/L</span>
            <strong className={`overview-value ${initialSummary.netPlUsd >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrencySigned(initialSummary.netPlUsd)}
            </strong>
          </article>
        </div>
      </section>

      <section className="surface-card performance-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">Casino Performance</div>
            <h2 className="section-title overview-title">Best to worst by portfolio impact</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="performance-table">
            <thead>
              <tr>
                <SortableHeader label="Casino name" active={sortKey === 'name'} direction={sortDirection} onClick={() => toggleSort('name')} />
                <SortableHeader label="SC Balance" active={sortKey === 'scBalance'} direction={sortDirection} onClick={() => toggleSort('scBalance')} />
                <SortableHeader label="USD Invested" active={sortKey === 'usdInvested'} direction={sortDirection} onClick={() => toggleSort('usdInvested')} />
                <SortableHeader label="USD Redeemed" active={sortKey === 'usdRedeemed'} direction={sortDirection} onClick={() => toggleSort('usdRedeemed')} />
                <SortableHeader label="Net P/L" active={sortKey === 'netPlUsd'} direction={sortDirection} onClick={() => toggleSort('netPlUsd')} />
                <SortableHeader label="Last Activity" active={sortKey === 'lastActivityAt'} direction={sortDirection} onClick={() => toggleSort('lastActivityAt')} />
              </tr>
            </thead>
            <tbody>
              {casinoRows.map((casino) => (
                <tr key={casino.casinoId} onClick={() => (window.location.href = `/my-casinos#casino-${casino.casinoId}`)}>
                  <td>
                    <div className="casino-cell">
                      <a href={`/my-casinos#casino-${casino.casinoId}`} className="casino-link" onClick={(event) => event.stopPropagation()}>
                        {casino.name}
                      </a>
                      {casino.tier ? <span className="tier-badge" style={getTierBadgeStyle(casino.tier)}>{casino.tier}</span> : null}
                    </div>
                  </td>
                  <td>{formatNumber(casino.scBalance)}</td>
                  <td>{formatCurrency(casino.usdInvested)}</td>
                  <td>{formatCurrency(casino.usdRedeemed)}</td>
                  <td className={casino.netPlUsd >= 0 ? 'positive' : 'negative'}>{formatCurrency(casino.netPlUsd)}</td>
                  <td>{casino.lastActivityAt ? formatDateTimeCompact(casino.lastActivityAt) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {initialRecentActivity.length > 0 ? (
        <section className="surface-card activity-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">Recent Activity</div>
              <h2 className="section-title overview-title">Latest ledger movement</h2>
            </div>
          </div>
          <div className="activity-list">
            {initialRecentActivity.map((entry) => (
              <div key={entry.id} className="activity-row">
                <div className="activity-copy">
                  <a href={`/casinos/${entry.casinoSlug}`} className="casino-link">{entry.casinoName}</a>
                  <span className="muted">{formatEntryType(entry.entryType)}</span>
                </div>
                <div className="activity-values">
                  <span className={getTone(entry.scAmount)}>{entry.scAmount === null ? '--' : formatSignedNumber(entry.scAmount)}</span>
                  <span className={getTone(entry.usdAmount)}>{entry.usdAmount === null ? '--' : formatCurrency(entry.usdAmount)}</span>
                  <span className="muted">{entry.entryAt ? formatDateTimeCompact(entry.entryAt) : '--'}</span>
                </div>
              </div>
            ))}
          </div>
          <a href="/ledger" className="activity-link">View full ledger →</a>
        </section>
      ) : null}

      <style>{`
        .reports-shell { display:grid; gap:1.25rem; }
        .reports-hero, .overview-card, .performance-card, .activity-card { padding:1.25rem 1.35rem; }
        .reports-title, .overview-title { margin:.2rem 0 0; }
        .reports-subtitle { margin:.35rem 0 0; }
        .eyebrow { color: var(--text-muted); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
        .kpi-grid { display:grid; gap:1rem; grid-template-columns:repeat(4, minmax(0, 1fr)); }
        .kpi-card { padding:1.4rem; display:grid; gap:.55rem; min-height:132px; align-content:start; }
        .kpi-label, .overview-label { color:var(--text-muted); font-size:.78rem; letter-spacing:.08em; text-transform:uppercase; font-weight:800; }
        .kpi-value { color:var(--text-primary); font-size:2rem; letter-spacing:-.04em; font-weight:800; }
        .kpi-subvalue { color:var(--text-secondary); font-size:1rem; font-weight:700; }
        .kpi-positive, .positive { color:var(--accent-green); }
        .kpi-pending { color:var(--accent-yellow); }
        .kpi-negative, .negative { color:var(--accent-red); }
        .overview-grid { display:grid; gap:1rem; grid-template-columns:repeat(4, minmax(0, 1fr)); }
        .overview-item { display:grid; gap:.45rem; padding:1rem; border-radius:1rem; border:1px solid var(--color-border); background:rgba(17, 24, 39, 0.4); }
        .overview-value { color:var(--text-primary); font-size:1.7rem; font-weight:800; letter-spacing:-.04em; }
        .section-head { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; flex-wrap:wrap; margin-bottom:1rem; }
        .table-wrap { overflow-x:auto; }
        .performance-table { width:100%; border-collapse:collapse; }
        .performance-table th, .performance-table td { padding:.9rem; border-bottom:1px solid var(--color-border); text-align:left; vertical-align:middle; }
        .performance-table tbody tr:nth-child(odd) { background:rgba(17, 24, 39, 0.38); }
        .performance-table tbody tr:nth-child(even) { background:rgba(17, 24, 39, 0.52); }
        .performance-table tbody tr { cursor:pointer; }
        .sort-button { border:none; background:transparent; color:var(--text-secondary); font:inherit; font-weight:700; cursor:pointer; padding:0; display:inline-flex; gap:.35rem; align-items:center; }
        .sort-button-active { color:var(--text-primary); }
        .casino-cell { display:flex; align-items:center; gap:.55rem; flex-wrap:wrap; }
        .casino-link { color:var(--text-primary); text-decoration:none; font-weight:800; }
        .tier-badge { display:inline-flex; min-width:2rem; justify-content:center; border-radius:999px; padding:.25rem .55rem; font-size:.78rem; font-weight:800; border:1px solid transparent; }
        .activity-list { display:grid; gap:.75rem; }
        .activity-row { display:flex; justify-content:space-between; gap:1rem; align-items:center; padding:.85rem .95rem; border:1px solid var(--color-border); border-radius:1rem; background:rgba(17, 24, 39, 0.42); }
        .activity-copy, .activity-values { display:flex; gap:.75rem; align-items:center; flex-wrap:wrap; }
        .activity-link { color:var(--accent-blue); text-decoration:none; font-weight:700; }
        @media (max-width: 1100px) { .kpi-grid, .overview-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 720px) { .kpi-grid, .overview-grid { grid-template-columns:1fr; } .activity-row { flex-direction:column; align-items:flex-start; } }
      `}</style>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <th>
      <button type="button" className={`sort-button ${active ? 'sort-button-active' : ''}`} onClick={onClick}>
        {label}
        <span>{active ? (direction === 'desc' ? '↓' : '↑') : '↕'}</span>
      </button>
    </th>
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

function getTone(value: number | null) {
  if (value === null || value === 0) return 'muted';
  return value > 0 ? 'positive' : 'negative';
}

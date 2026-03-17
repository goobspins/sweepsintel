import { formatCurrency, formatDateTimeCompact, formatNumber, getTierBadgeStyle } from '../../lib/format';
import type { ReportCasinoRow, SortKey } from './types';

interface CasinoPerformanceTableProps {
  rows: ReportCasinoRow[];
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  onToggleSort: (key: SortKey) => void;
}

export default function CasinoPerformanceTable({
  rows,
  sortKey,
  sortDirection,
  onToggleSort,
}: CasinoPerformanceTableProps) {
  return (
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
              <SortableHeader label="Casino name" active={sortKey === 'name'} direction={sortDirection} onClick={() => onToggleSort('name')} />
              <SortableHeader label="SC Balance" active={sortKey === 'scBalance'} direction={sortDirection} onClick={() => onToggleSort('scBalance')} />
              <SortableHeader label="USD Invested" active={sortKey === 'usdInvested'} direction={sortDirection} onClick={() => onToggleSort('usdInvested')} />
              <SortableHeader label="USD Redeemed" active={sortKey === 'usdRedeemed'} direction={sortDirection} onClick={() => onToggleSort('usdRedeemed')} />
              <SortableHeader label="Net P/L" active={sortKey === 'netPlUsd'} direction={sortDirection} onClick={() => onToggleSort('netPlUsd')} />
              <SortableHeader label="Last Activity" active={sortKey === 'lastActivityAt'} direction={sortDirection} onClick={() => onToggleSort('lastActivityAt')} />
            </tr>
          </thead>
          <tbody>
            {rows.map((casino) => (
              <tr key={casino.casinoId} onClick={() => (window.location.href = `/my-casinos#casino-${casino.casinoId}`)}>
                <td>
                  <div className="casino-cell">
                    <a href={`/my-casinos#casino-${casino.casinoId}`} className="casino-link" onClick={(event) => event.stopPropagation()}>{casino.name}</a>
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
      <style>{`
        .performance-card { padding:1.25rem 1.35rem; }
        .overview-title { margin:.2rem 0 0; }
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
        .positive { color:var(--accent-green); }
        .negative { color:var(--accent-red); }
      `}</style>
    </section>
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

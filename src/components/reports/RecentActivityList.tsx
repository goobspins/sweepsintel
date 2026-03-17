import { formatCurrency, formatDateTimeCompact, formatEntryType, formatSignedNumber } from '../../lib/format';
import type { RecentActivityRow } from './types';

interface RecentActivityListProps {
  items: RecentActivityRow[];
}

export default function RecentActivityList({ items }: RecentActivityListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="surface-card activity-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">Recent Activity</div>
          <h2 className="section-title overview-title">Latest ledger movement</h2>
        </div>
      </div>
      <div className="activity-list">
        {items.map((entry) => (
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
      <style>{`
        .activity-card { padding:1.25rem 1.35rem; }
        .overview-title { margin:.2rem 0 0; }
        .section-head { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; flex-wrap:wrap; margin-bottom:1rem; }
        .activity-list { display:grid; gap:.75rem; }
        .activity-row { display:flex; justify-content:space-between; gap:1rem; align-items:center; padding:.85rem .95rem; border:1px solid var(--color-border); border-radius:1rem; background:rgba(17, 24, 39, 0.42); }
        .activity-copy, .activity-values { display:flex; gap:.75rem; align-items:center; flex-wrap:wrap; }
        .casino-link { color:var(--text-primary); text-decoration:none; font-weight:800; }
        .activity-link { color:var(--accent-blue); text-decoration:none; font-weight:700; }
        .positive { color:var(--accent-green); }
        .negative { color:var(--accent-red); }
        @media (max-width: 720px) { .activity-row { flex-direction:column; align-items:flex-start; } }
      `}</style>
    </section>
  );
}

function getTone(value: number | null) {
  if (value === null || value === 0) return 'muted';
  return value > 0 ? 'positive' : 'negative';
}

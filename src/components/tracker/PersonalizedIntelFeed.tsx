import { DateTime } from 'luxon';

import type { TrackerAlertItem } from '../../lib/tracker';

interface PersonalizedIntelFeedProps {
  items: TrackerAlertItem[];
  nowTs: number;
  reactingId: number | null;
  onReact: (itemId: number, reaction: 'confirm' | 'dispute') => void;
}

const badgeColors: Record<string, string> = {
  free_sc: 'var(--accent-green)',
  promo_code: 'var(--accent-blue)',
  flash_sale: 'var(--accent-blue)',
  playthrough_deal: '#7C3AED',
  platform_warning: 'var(--accent-yellow)',
  state_intel: 'var(--accent-yellow)',
  general_tip: 'var(--text-muted)',
};

export default function PersonalizedIntelFeed({
  items,
  nowTs,
  reactingId,
  onReact,
}: PersonalizedIntelFeedProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="surface-card intel-shell">
      <div className="intel-heading">
        <h2 className="section-title">My Alerts</h2>
        <span className="muted">Intel for your casinos</span>
      </div>
      <div className="intel-list">
        {items.slice(0, 10).map((item) => {
          const expiry = item.expires_at
            ? formatExpiry(item.expires_at, nowTs)
            : null;

          return (
            <article key={item.id} className="intel-card">
              <div className="intel-topline">
                <span
                  className="intel-badge"
                  style={{
                    background: `${badgeColors[item.item_type] ?? 'var(--text-muted)'}1A`,
                    color: badgeColors[item.item_type] ?? 'var(--text-muted)',
                  }}
                >
                  {item.item_type.replace(/_/g, ' ')}
                </span>
                <span className="muted">
                  {DateTime.fromISO(item.created_at).toRelative() ?? 'Now'}
                </span>
              </div>
              <strong>{item.title}</strong>
              <p className="muted">{item.content}</p>
              <div className="intel-footer">
                <span>Confirm: {item.confirm_count}</span>
                <span>Dispute: {item.dispute_count}</span>
                {expiry ? <span style={{ color: expiry.color }}>{expiry.label}</span> : null}
              </div>
              <div className="intel-actions">
                <button
                  type="button"
                  onClick={() => onReact(item.id, 'confirm')}
                  disabled={reactingId === item.id}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => onReact(item.id, 'dispute')}
                  disabled={reactingId === item.id}
                  className="secondary"
                >
                  Dispute
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <style>{`
        .intel-shell {
          padding: 1.25rem;
          display: grid;
          gap: 1rem;
        }

        .intel-heading {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: baseline;
          flex-wrap: wrap;
        }

        .intel-heading .section-title {
          margin: 0;
          font-size: 1.5rem;
        }

        .intel-list {
          display: grid;
          gap: 0.9rem;
        }

        .intel-card {
          display: grid;
          gap: 0.7rem;
          padding: 1rem;
          border-radius: 1rem;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
        }

        .intel-topline,
        .intel-footer,
        .intel-actions {
          display: flex;
          gap: 0.8rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .intel-badge {
          border-radius: 999px;
          padding: 0.3rem 0.55rem;
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: capitalize;
        }

        .intel-card p {
          margin: 0;
          line-height: 1.55;
        }

        .intel-actions button {
          border: none;
          border-radius: 999px;
          padding: 0.62rem 0.9rem;
          background: var(--color-primary);
          color: var(--text-primary);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .intel-actions .secondary {
          background: var(--bg-primary);
          color: var(--color-ink);
          border: 1px solid var(--color-border);
        }
      `}</style>
    </section>
  );
}

function formatExpiry(expiresAt: string, nowTs: number) {
  const now = DateTime.fromMillis(nowTs);
  const expiry = DateTime.fromISO(expiresAt);
  if (!expiry.isValid) {
    return null;
  }

  const minutes = Math.max(0, Math.ceil(expiry.diff(now, 'minutes').minutes));
  if (minutes <= 60) {
    return { label: `Expires in ${minutes}m`, color: 'var(--color-danger)' };
  }

  const hours = Math.floor(minutes / 60);
  return { label: `Expires in ${hours}h`, color: 'var(--color-warning)' };
}


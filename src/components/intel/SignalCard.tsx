import { useMemo, useState } from 'react';

import { formatAgo, formatRelativeExpiry } from '../../lib/format';
import { SIGNAL_TYPE_LABELS } from '../../lib/intel-constants';
import VoteButtons from './VoteButtons';
import type { SignalItem } from './types';

interface SignalCardProps {
  item: SignalItem;
  onVote: (signalId: number, vote: 'worked' | 'didnt_work') => Promise<void> | void;
  highlighted?: boolean;
}

function getSignalAccent(itemType: string) {
  if (itemType === 'free_sc') return 'var(--accent-green)';
  if (itemType === 'promo_code') return 'var(--accent-blue)';
  if (itemType === 'flash_sale') return 'var(--accent-yellow)';
  if (itemType === 'playthrough_deal') return '#a78bfa';
  if (itemType === 'platform_warning') return 'var(--accent-red)';
  return 'var(--text-secondary)';
}

function getStatusTone(status: string) {
  if (status === 'collapsed') return 'status-collapsed';
  if (status === 'likely_outdated') return 'status-outdated';
  if (status === 'conditional') return 'status-conditional';
  return 'status-active';
}

export default function SignalCard({ item, onVote, highlighted = false }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [pendingVote, setPendingVote] = useState<'worked' | 'didnt_work' | null>(null);

  const signalAccent = getSignalAccent(item.item_type);
  const typeLabel = SIGNAL_TYPE_LABELS[item.item_type] ?? item.item_type.replace(/_/g, ' ');
  const expiryLabel = item.expires_at ? formatRelativeExpiry(item.expires_at) : null;
  const shouldExpand = item.content.length > 180;
  const statusLabel = useMemo(() => {
    if (expiryLabel === 'Expired') return 'Expired';
    if (!item.signal_status || item.signal_status === 'active') return null;
    return item.signal_status.replace(/_/g, ' ');
  }, [expiryLabel, item.signal_status]);

  const attribution =
    item.attribution?.display_name ??
    (item.item_type === 'platform_warning' ? 'Community warning' : 'Community member');

  async function handleVote(vote: 'worked' | 'didnt_work') {
    setPendingVote(vote);
    try {
      await onVote(item.id, vote);
    } finally {
      setPendingVote(null);
    }
  }

  return (
    <article
      className={`signal-card signal-card-${item.item_type} ${highlighted ? 'signal-card-highlighted' : ''}`}
      style={{ '--signal-accent': signalAccent } as React.CSSProperties}
    >
      {statusLabel ? (
        <div className={`status-banner ${getStatusTone(expiryLabel === 'Expired' ? 'collapsed' : item.signal_status)}`}>
          {statusLabel}
        </div>
      ) : null}

      <div className="signal-top">
        <span className="signal-badge">{typeLabel}</span>
        <span className="muted">{formatAgo(item.created_at)}</span>
      </div>

      {item.casino ? (
        <a className="casino-link" href={`/casinos/${item.casino.slug}`}>
          {item.casino.name}
        </a>
      ) : null}

      <strong className="signal-title">{item.title}</strong>

      <div className={`signal-body ${expanded ? 'signal-body-expanded' : ''}`}>
        {item.content}
      </div>

      {shouldExpand ? (
        <button type="button" className="expand-button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}

      <div className="signal-meta">
        <span className="muted attribution-line">
          By {attribution}
          {item.attribution?.display_name && item.attribution?.contributor_tier && item.attribution.contributor_tier !== 'newcomer' ? (
            <span className="tier-pill">{item.attribution.contributor_tier}</span>
          ) : null}
        </span>
        {expiryLabel ? <span className={expiryLabel === 'Expired' ? 'expiry-expired' : 'muted'}>{expiryLabel}</span> : null}
      </div>

      <div className="vote-row">
        <VoteButtons
          itemType={item.item_type}
          workedCount={item.worked_count}
          didntWorkCount={item.didnt_work_count}
          pendingVote={pendingVote}
          onVote={handleVote}
        />
      </div>

      <style>{`
        .signal-card {
          --signal-accent: var(--text-secondary);
          display: grid;
          gap: 0.8rem;
          padding: 1.05rem 1.1rem;
          border-radius: 1.1rem;
          border: 1px solid var(--color-border);
          border-left: 4px solid var(--signal-accent);
          background: rgba(17, 24, 39, 0.5);
          color: var(--text-primary);
        }
        .signal-card-highlighted {
          animation: signalHighlight 2s ease forwards;
          box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.28), 0 0 24px rgba(16, 185, 129, 0.12);
        }
        .status-banner {
          margin: -1.05rem -1.1rem 0;
          padding: 0.65rem 1rem;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .status-collapsed { background: rgba(239, 68, 68, 0.14); color: var(--accent-red); }
        .status-outdated,
        .status-conditional { background: rgba(245, 158, 11, 0.14); color: var(--accent-yellow); }
        .signal-top,
        .signal-meta {
          display: flex;
          gap: 0.55rem;
          align-items: center;
          flex-wrap: wrap;
          justify-content: space-between;
        }
        .signal-badge {
          display: inline-flex;
          width: fit-content;
          padding: 0.34rem 0.62rem;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 800;
          background: color-mix(in srgb, var(--signal-accent) 14%, transparent);
          color: var(--signal-accent);
        }
        .casino-link {
          color: var(--text-primary);
          text-decoration: none;
          font-size: 1.05rem;
          font-weight: 800;
        }
        .signal-title {
          color: var(--text-primary);
          font-size: 1.15rem;
          line-height: 1.35;
        }
        .signal-body {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.7;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .signal-body-expanded {
          display: block;
          -webkit-line-clamp: unset;
        }
        .expand-button {
          border: none;
          background: transparent;
          color: var(--accent-blue);
          padding: 0;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          justify-self: start;
        }
        .signal-meta {
          color: var(--text-muted);
          font-size: 0.88rem;
        }
        .attribution-line {
          display: inline-flex;
          gap: 0.45rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .tier-pill {
          display: inline-flex;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.12);
          color: var(--text-secondary);
          font-size: 0.74rem;
          font-weight: 800;
        }
        .expiry-expired { color: var(--accent-red); font-weight: 700; }
        .vote-row {
          padding-top: 0.8rem;
          border-top: 1px solid rgba(148, 163, 184, 0.14);
        }
        .muted { color: var(--text-muted); }
        @keyframes signalHighlight {
          0% { box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.28), 0 0 24px rgba(16, 185, 129, 0.18); }
          100% { box-shadow: 0 0 0 1px rgba(16, 185, 129, 0), 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </article>
  );
}

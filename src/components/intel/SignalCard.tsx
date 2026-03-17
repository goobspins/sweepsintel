import { useState } from 'react';

import { formatAgo, formatRelativeExpiry } from '../../lib/format';
import VoteButtons from './VoteButtons';

interface SignalCardProps {
  item: any;
  onVote: (signalId: number, vote: 'worked' | 'didnt_work') => Promise<void> | void;
}

const TYPE_LABELS: Record<string, string> = {
  free_sc: 'Free SC',
  promo_code: 'Promo Code',
  flash_sale: 'Flash Sale',
  playthrough_deal: 'Playthrough Deal',
  platform_warning: 'Warning',
  general_tip: 'General Tip',
};

function badgeTone(itemType: string) {
  if (itemType === 'free_sc') return { background: 'rgba(16,185,129,.14)', color: 'var(--accent-green)' };
  if (itemType === 'promo_code') return { background: 'rgba(59,130,246,.14)', color: 'var(--accent-blue)' };
  if (itemType === 'flash_sale') return { background: 'rgba(245,158,11,.14)', color: 'var(--accent-yellow)' };
  if (itemType === 'playthrough_deal') return { background: 'rgba(139,92,246,.16)', color: '#a78bfa' };
  if (itemType === 'platform_warning') return { background: 'rgba(239,68,68,.14)', color: 'var(--accent-red)' };
  return { background: 'rgba(156,163,175,.14)', color: 'var(--text-secondary)' };
}

export default function SignalCard({ item, onVote }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const badge = badgeTone(item.item_type);

  async function handleVote(vote: 'worked' | 'didnt_work') {
    setPending(true);
    try {
      await onVote(item.id, vote);
    } finally {
      setPending(false);
    }
  }

  const attribution =
    item.attribution?.display_name ?? (item.item_type === 'platform_warning' ? 'Community warning' : 'Community member');
  const expiryLabel = item.expires_at ? formatRelativeExpiry(item.expires_at) : null;
  const typeLabel = TYPE_LABELS[item.item_type] ?? item.item_type.replace(/_/g, ' ');

  return (
    <article className={`signal-card signal-card-${item.item_type}`}>
      <div className="signal-top">
        <span className="signal-badge" style={badge}>{typeLabel}</span>
        <span className="muted">{formatAgo(item.created_at)}</span>
      </div>
      {item.casino ? (
        <a className="casino-link" href={`/casinos/${item.casino.slug}`}>{item.casino.name}</a>
      ) : null}
      <strong className="signal-title">{item.title}</strong>
      <p className="signal-body">{expanded ? item.content : truncate(item.content, 220)}</p>
      <div className="signal-state">
        <span className="muted attribution-line">
          By {attribution}
          {item.attribution?.display_name && item.attribution?.contributor_tier && item.attribution.contributor_tier !== 'newcomer' ? (
            <span className="tier-pill">{item.attribution.contributor_tier}</span>
          ) : null}
        </span>
        {expiryLabel ? <span className={expiryLabel === 'Expired' ? 'expiry-expired' : 'muted'}>{expiryLabel}</span> : null}
        {item.signal_status && item.signal_status !== 'active' ? (
          <span className="status-pill">{item.signal_status.replace(/_/g, ' ')}</span>
        ) : null}
      </div>
      <VoteButtons
        itemType={item.item_type}
        workedCount={item.worked_count}
        didntWorkCount={item.didnt_work_count}
        pending={pending}
        onVote={handleVote}
      />
      <button type="button" className="expand-button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Show less' : 'Expand'}
      </button>
      <style>{`
        .signal-card {
          display:grid;
          gap:.8rem;
          padding:1rem;
          border-radius:1.1rem;
          border:1px solid var(--color-border);
          border-left:4px solid currentColor;
          background:rgba(17, 24, 39, 0.5);
          color:var(--text-primary);
        }
        .signal-card-free_sc { color: var(--accent-green); }
        .signal-card-promo_code { color: var(--accent-blue); }
        .signal-card-flash_sale { color: var(--accent-yellow); }
        .signal-card-playthrough_deal { color: #a78bfa; }
        .signal-card-platform_warning { color: var(--accent-red); }
        .signal-card-general_tip { color: var(--text-secondary); }
        .signal-top, .signal-state { display:flex; gap:.55rem; align-items:center; flex-wrap:wrap; justify-content:space-between; }
        .signal-badge, .tier-pill, .status-pill { display:inline-flex; width:fit-content; padding:.3rem .6rem; border-radius:999px; font-size:.78rem; font-weight:800; text-transform:capitalize; }
        .tier-pill, .status-pill { background:rgba(59,130,246,.12); color:var(--text-secondary); }
        .casino-link { color:var(--text-primary); text-decoration:none; font-weight:800; font-size:1.02rem; }
        .signal-title { font-size:1.08rem; line-height:1.35; color:var(--text-primary); }
        .signal-body { margin:0; color:var(--text-secondary); line-height:1.6; }
        .attribution-line { display:inline-flex; gap:.45rem; align-items:center; flex-wrap:wrap; }
        .expiry-expired { color:var(--accent-red); font-weight:700; }
        .expand-button { border:none; background:transparent; color:var(--accent-blue); padding:0; font:inherit; font-weight:700; cursor:pointer; justify-self:start; }
        .muted { color:var(--text-muted); }
      `}</style>
    </article>
  );
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
}

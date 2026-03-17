import { useState } from 'react';

import VoteButtons from './VoteButtons';

interface SignalCardProps {
  item: any;
  onVote: (signalId: number, vote: 'worked' | 'didnt_work') => Promise<void> | void;
}

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

  return (
    <article className="signal-card">
      <div className="signal-top">
        <span className="signal-badge" style={badge}>{item.item_type.replace(/_/g, ' ')}</span>
        <span className="muted">{formatAgo(item.created_at)}</span>
      </div>
      <div className="signal-meta">
        <strong>{attribution}</strong>
        {item.attribution?.display_name && item.attribution?.contributor_tier && item.attribution.contributor_tier !== 'newcomer' ? (
          <span className="tier-pill">{item.attribution.contributor_tier}</span>
        ) : null}
      </div>
      {item.casino ? (
        <a className="casino-link" href={`/casinos/${item.casino.slug}`}>{item.casino.name}</a>
      ) : null}
      <strong className="signal-title">{item.title}</strong>
      <p className="signal-body">{expanded ? item.content : truncate(item.content, 220)}</p>
      <div className="signal-state">
        {item.expires_at ? <span className="muted">{formatExpiry(item.expires_at)}</span> : null}
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
        .signal-card { display:grid; gap:.75rem; padding:1rem; border-radius:1.1rem; border:1px solid var(--color-border); background:rgba(17, 24, 39, 0.5); }
        .signal-top, .signal-meta, .signal-state { display:flex; gap:.55rem; align-items:center; flex-wrap:wrap; justify-content:space-between; }
        .signal-badge, .tier-pill, .status-pill { display:inline-flex; width:fit-content; padding:.3rem .6rem; border-radius:999px; font-size:.78rem; font-weight:800; text-transform:capitalize; }
        .tier-pill, .status-pill { background:rgba(59,130,246,.12); color:var(--text-secondary); }
        .casino-link { color:var(--text-primary); text-decoration:none; font-weight:800; }
        .signal-title { font-size:1.05rem; line-height:1.4; }
        .signal-body { margin:0; color:var(--text-secondary); line-height:1.6; }
        .expand-button { border:none; background:transparent; color:var(--accent-blue); padding:0; font:inherit; font-weight:700; cursor:pointer; justify-self:start; }
        .muted { color:var(--text-muted); }
      `}</style>
    </article>
  );
}

function formatAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'now';
  return date.toLocaleString();
}

function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Expiry unknown';
  return date.getTime() < Date.now() ? 'Expired' : `Expires ${date.toLocaleString()}`;
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
}

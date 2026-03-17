import { useState } from 'react';

import { SIGNAL_TYPE_LABELS } from '../../lib/intel-constants';
import SignalTracker from './SignalTracker';

interface SignalCreatorProps {
  casinos: Array<{ id: number; name: string }>;
  digest: {
    summary: {
      total_signals: number;
      worked_signals: number;
      disputed_signals: number;
      unverified_signals: number;
    };
    flagged_users: Array<{ user_id: string; trust_score: number; contributor_tier: string | null }>;
    top_contributors: Array<{ user_id: string; contributor_tier: string | null; signal_count: number; worked_votes: number; didnt_work_votes: number }>;
  };
  items: Array<{
    id: number;
    casino_name: string | null;
    source: string;
    title: string;
    item_type: string;
    signal_status: string;
    worked_count: number;
    didnt_work_count: number;
    created_at: string;
  }>;
}

export default function SignalCreator({ casinos, digest, items }: SignalCreatorProps) {
  const [casinoId, setCasinoId] = useState(String(casinos[0]?.id ?? ''));
  const [signalType, setSignalType] = useState('general_tip');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch('/api/admin/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: Number(casinoId),
          signal_type: signalType,
          title,
          details,
          expires_at: expiresAt || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to create signal.');
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="signal-admin-shell">
      <section className="surface-card digest-card">
        <h1 className="section-title" style={{ margin: 0 }}>Signals</h1>
        <div className="digest-grid">
          <div><span>Total signals</span><strong>{digest.summary.total_signals ?? 0}</strong></div>
          <div><span>Worked</span><strong>{digest.summary.worked_signals ?? 0}</strong></div>
          <div><span>Disputed</span><strong>{digest.summary.disputed_signals ?? 0}</strong></div>
          <div><span>Unverified</span><strong>{digest.summary.unverified_signals ?? 0}</strong></div>
        </div>
      </section>

      <form className="surface-card form-card" onSubmit={handleSubmit}>
        <h2 style={{ margin: 0 }}>Create Team Signal</h2>
        <div className="field-grid">
          <select value={casinoId} onChange={(event) => setCasinoId(event.target.value)}>
            {casinos.map((casino) => (
              <option key={casino.id} value={casino.id}>{casino.name}</option>
            ))}
          </select>
          <select value={signalType} onChange={(event) => setSignalType(event.target.value)}>
            {Object.entries(SIGNAL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Signal title" />
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Signal details" />
        <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        <button type="submit" disabled={pending}>{pending ? 'Posting...' : 'Post signal'}</button>
      </form>

      <SignalTracker items={items} />

      <section className="surface-card digest-card">
        <h2 style={{ margin: '0 0 1rem' }}>Top Contributors</h2>
        <div className="digest-list">
          {digest.top_contributors.map((contributor) => (
            <div key={contributor.user_id} className="digest-row">
              <strong>{contributor.user_id}</strong>
              <span>{contributor.contributor_tier ?? 'newcomer'}</span>
              <span>{contributor.signal_count} signals</span>
              <span>{contributor.worked_votes} worked / {contributor.didnt_work_votes} didn't</span>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .signal-admin-shell { display:grid; gap:1rem; }
        .digest-card, .form-card { padding:1.1rem; }
        .digest-grid { display:grid; gap:.85rem; grid-template-columns:repeat(4, minmax(0, 1fr)); }
        .digest-grid div, .digest-row { display:grid; gap:.25rem; padding:.8rem; border:1px solid var(--color-border); border-radius:1rem; background:rgba(17, 24, 39, 0.42); }
        .digest-grid span { color:var(--text-muted); font-size:.82rem; text-transform:uppercase; letter-spacing:.08em; font-weight:700; }
        .digest-grid strong { font-size:1.6rem; }
        .field-grid { display:grid; gap:.75rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        input, select, textarea, button { font:inherit; }
        input, select, textarea { border:1px solid var(--color-border); border-radius:1rem; padding:.82rem .9rem; background:var(--bg-primary); color:var(--text-primary); }
        textarea { min-height:120px; resize:vertical; }
        button { border:none; border-radius:999px; padding:.82rem 1rem; background:var(--accent-green); color:#0b1220; font-weight:800; cursor:pointer; }
        .digest-list { display:grid; gap:.65rem; }
      `}</style>
    </div>
  );
}

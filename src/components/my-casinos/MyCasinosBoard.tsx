import { useEffect, useMemo, useState } from 'react';

type RecentEntry = {
  id: number;
  entry_type: string;
  sc_amount: number | null;
  usd_amount: number | null;
  notes: string | null;
  entry_at: string | null;
};

type CasinoPortfolioRow = {
  casino_id: number;
  name: string;
  slug: string;
  tier: string | null;
  notes: string;
  claim_url: string | null;
  visit_url: string | null;
  sc_balance: number;
  usd_value: number;
  total_invested_usd: number;
  total_redeemed_usd: number;
  net_pl_usd: number;
  last_activity_at: string | null;
  recent_entries: RecentEntry[];
};

type MyCasinosBoardProps = {
  initialData: {
    casinos: CasinoPortfolioRow[];
  };
};

type SortMode = 'last-activity' | 'name' | 'balance' | 'pl';
type ToastState = { tone: 'success' | 'error'; message: string } | null;

export default function MyCasinosBoard({ initialData }: MyCasinosBoardProps) {
  const [casinos, setCasinos] = useState(initialData.casinos);
  const [sortMode, setSortMode] = useState<SortMode>('last-activity');
  const [expandedCasinoId, setExpandedCasinoId] = useState<number | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<number, string>>(() =>
    Object.fromEntries(initialData.casinos.map((casino) => [casino.casino_id, casino.notes])),
  );
  const [savingNotesId, setSavingNotesId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const sortedCasinos = useMemo(() => {
    const rows = [...casinos];
    rows.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (sortMode === 'balance') return b.usd_value - a.usd_value || b.sc_balance - a.sc_balance || a.name.localeCompare(b.name);
      if (sortMode === 'pl') return b.net_pl_usd - a.net_pl_usd || a.name.localeCompare(b.name);

      const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return bTime - aTime || a.name.localeCompare(b.name);
    });
    return rows;
  }, [casinos, sortMode]);

  async function saveNotes(casinoId: number) {
    const nextValue = (draftNotes[casinoId] ?? '').trim();
    const currentValue = casinos.find((casino) => casino.casino_id === casinoId)?.notes.trim() ?? '';
    if (nextValue === currentValue) return;

    setSavingNotesId(casinoId);
    try {
      const response = await fetch('/api/my-casinos/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casino_id: casinoId, notes: nextValue || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save notes.');

      setCasinos((current) =>
        current.map((casino) =>
          casino.casino_id === casinoId ? { ...casino, notes: data.notes ?? '' } : casino,
        ),
      );
      setDraftNotes((current) => ({ ...current, [casinoId]: data.notes ?? '' }));
      setToast({ tone: 'success', message: 'Notes saved.' });
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to save notes.' });
    } finally {
      setSavingNotesId(null);
    }
  }

  return (
    <div className="portfolio-shell">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}

      <section className="surface-card board-card">
        <div className="board-header">
          <div>
            <div className="eyebrow">Portfolio</div>
            <h1 className="section-title">My Casinos</h1>
            <p className="muted board-copy">Every tracked casino, with balances, capital flow, and the notes that keep your rhythm intact.</p>
          </div>
          <div className="sort-panel">
            <span className="muted sort-label">Sort by</span>
            <div className="sort-pills">
              {([
                ['last-activity', 'Last Activity'],
                ['name', 'Name'],
                ['balance', 'Balance'],
                ['pl', 'P/L'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`sort-pill ${sortMode === value ? 'sort-pill-active' : ''}`}
                  onClick={() => setSortMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card-list">
          {sortedCasinos.map((casino) => {
            const expanded = expandedCasinoId === casino.casino_id;
            const draftValue = draftNotes[casino.casino_id] ?? '';
            const saving = savingNotesId === casino.casino_id;

            return (
              <article key={casino.casino_id} className="casino-card">
                <button
                  type="button"
                  className="casino-card-head"
                  onClick={() => setExpandedCasinoId((current) => current === casino.casino_id ? null : casino.casino_id)}
                >
                  <div className="casino-main">
                    <div className="casino-title-row">
                      <strong className="casino-name">{casino.name}</strong>
                      {casino.tier ? <span className="tier-badge" style={getTierBadgeStyle(casino.tier)}>{casino.tier}</span> : null}
                    </div>
                    <div className="casino-subline">
                      <span className="metric-cluster">
                        <span className="metric-label">SC Balance</span>
                        <strong>{formatSc(casino.sc_balance)}</strong>
                        <span className="muted">({formatCurrency(casino.usd_value)})</span>
                      </span>
                      <span className="metric-cluster">
                        <span className="metric-label">Last Activity</span>
                        <strong>{casino.last_activity_at ? formatDateTime(casino.last_activity_at) : 'No entries yet'}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="casino-financials">
                    <div className="summary-chip">
                      <span className="metric-label">Invested</span>
                      <strong>{formatCurrency(casino.total_invested_usd)}</strong>
                    </div>
                    <div className="summary-chip">
                      <span className="metric-label">Redeemed</span>
                      <strong>{formatCurrency(casino.total_redeemed_usd)}</strong>
                    </div>
                    <div className="summary-chip">
                      <span className="metric-label">Net P/L</span>
                      <strong className={casino.net_pl_usd > 0 ? 'positive' : casino.net_pl_usd < 0 ? 'negative' : ''}>
                        {formatCurrency(casino.net_pl_usd)}
                      </strong>
                    </div>
                    <span className="expand-indicator">{expanded ? 'Hide' : 'Expand'}</span>
                  </div>
                </button>

                <div className="card-body">
                  <div className="notes-panel">
                    <label className="notes-label" htmlFor={`notes-${casino.casino_id}`}>Operating notes</label>
                    <textarea
                      id={`notes-${casino.casino_id}`}
                      value={draftValue}
                      placeholder="good wash games, slow redemptions, avoid deals here..."
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setDraftNotes((current) => ({ ...current, [casino.casino_id]: event.target.value }))}
                      onBlur={() => void saveNotes(casino.casino_id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <span className="muted notes-hint">{saving ? 'Saving...' : 'Saves on blur or Enter'}</span>
                  </div>

                  <div className="quick-actions">
                    <a href={`/dashboard#casino-${casino.casino_id}`} className="action-link action-claim">Claim</a>
                    {casino.visit_url ? (
                      <a
                        href={casino.visit_url}
                        className="action-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Visit
                      </a>
                    ) : null}
                    <a href={`/casinos/${casino.slug}`} className="action-link action-secondary">Profile</a>
                  </div>
                </div>

                {expanded ? (
                  <div className="expanded-panel">
                    <div className="expanded-header">
                      <h2 className="expanded-title">Recent ledger entries</h2>
                      <a href={`/ledger?casino_id=${casino.casino_id}`} className="muted expanded-link">Open full ledger</a>
                    </div>
                    {casino.recent_entries.length === 0 ? (
                      <p className="muted expanded-empty">No ledger entries yet for this casino.</p>
                    ) : (
                      <div className="entry-list">
                        {casino.recent_entries.map((entry) => (
                          <div key={entry.id} className="entry-row">
                            <div className="entry-copy">
                              <strong>{entry.entry_type}</strong>
                              <span className="muted">{entry.entry_at ? formatDateTime(entry.entry_at) : 'Unknown time'}</span>
                              {entry.notes ? <span className="muted">{entry.notes}</span> : null}
                            </div>
                            <div className="entry-values">
                              <span>{entry.sc_amount === null ? '--' : `${formatSc(entry.sc_amount)} SC`}</span>
                              <strong className={entry.usd_amount !== null && entry.usd_amount > 0 ? 'positive' : entry.usd_amount !== null && entry.usd_amount < 0 ? 'negative' : ''}>
                                {entry.usd_amount === null ? '--' : formatCurrency(entry.usd_amount)}
                              </strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <style>{`
        .portfolio-shell { display: grid; gap: 1.25rem; }
        .board-card { display: grid; gap: 1rem; padding: 1.2rem; }
        .board-header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
        .board-copy { margin: 0; max-width: 44rem; line-height: 1.65; }
        .sort-panel { display: grid; gap: 0.55rem; justify-items: end; }
        .sort-label { font-size: 0.84rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .sort-pills { display: flex; gap: 0.45rem; flex-wrap: wrap; justify-content: flex-end; }
        .sort-pill { border: 1px solid var(--color-border); background: var(--bg-primary); color: var(--text-secondary); border-radius: 999px; padding: 0.58rem 0.82rem; font-weight: 700; cursor: pointer; }
        .sort-pill-active { background: rgba(59, 130, 246, 0.14); color: var(--text-primary); border-color: rgba(59, 130, 246, 0.28); }
        .card-list { display: grid; gap: 0.9rem; }
        .casino-card { display: grid; gap: 0; border: 1px solid var(--color-border); border-radius: 1.35rem; background: rgba(17, 24, 39, 0.54); overflow: hidden; }
        .casino-card-head { border: none; background: transparent; color: inherit; padding: 1rem 1.05rem; display: flex; justify-content: space-between; gap: 1rem; align-items: stretch; cursor: pointer; text-align: left; }
        .casino-main, .casino-financials { display: grid; gap: 0.7rem; }
        .casino-title-row, .casino-subline { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
        .casino-name { font-size: 1.1rem; letter-spacing: -0.03em; }
        .metric-cluster { display: inline-flex; gap: 0.45rem; align-items: baseline; flex-wrap: wrap; }
        .metric-label, .notes-label { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .casino-financials { grid-template-columns: repeat(4, minmax(0, auto)); align-items: center; justify-content: end; }
        .summary-chip { display: grid; gap: 0.2rem; min-width: 118px; padding: 0.78rem 0.88rem; border-radius: 1rem; border: 1px solid var(--color-border); background: rgba(31, 41, 55, 0.68); }
        .expand-indicator { align-self: center; color: var(--text-muted); font-weight: 700; font-size: 0.85rem; }
        .positive { color: var(--accent-green); }
        .negative { color: var(--accent-red); }
        .card-body { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; padding: 0 1.05rem 1rem; }
        .notes-panel { display: grid; gap: 0.45rem; flex: 1 1 auto; }
        .notes-panel textarea { min-height: 78px; resize: vertical; border-radius: 1rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.82); color: var(--text-primary); padding: 0.85rem 0.95rem; line-height: 1.5; }
        .notes-hint { font-size: 0.82rem; }
        .quick-actions { display: flex; gap: 0.55rem; flex-wrap: wrap; justify-content: flex-end; }
        .action-link { display: inline-flex; align-items: center; justify-content: center; min-width: 92px; text-decoration: none; border-radius: 999px; padding: 0.78rem 1rem; border: 1px solid var(--color-border); background: var(--bg-primary); color: var(--text-primary); font-weight: 700; }
        .action-claim { background: rgba(16, 185, 129, 0.14); color: var(--accent-green); border-color: rgba(16, 185, 129, 0.28); }
        .action-secondary { color: var(--text-secondary); }
        .expanded-panel { display: grid; gap: 0.85rem; padding: 1rem 1.05rem 1.05rem; border-top: 1px solid var(--color-border); background: rgba(15, 23, 42, 0.34); }
        .expanded-header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; flex-wrap: wrap; }
        .expanded-title, .expanded-empty { margin: 0; }
        .expanded-title { font-size: 1rem; }
        .expanded-link { text-decoration: none; font-weight: 700; }
        .entry-list { display: grid; gap: 0.65rem; }
        .entry-row { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; padding: 0.8rem 0.1rem 0; border-top: 1px solid rgba(156, 163, 175, 0.16); }
        .entry-copy, .entry-values { display: grid; gap: 0.18rem; }
        .entry-values { justify-items: end; text-align: right; }
        .toast { position: sticky; top: 1rem; z-index: 15; justify-self: center; padding: 0.8rem 1rem; border-radius: 999px; font-weight: 700; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3); }
        .toast-success { background: rgba(16, 185, 129, 0.16); color: var(--accent-green); }
        .toast-error { background: rgba(239, 68, 68, 0.16); color: var(--accent-red); }
        @media (max-width: 1080px) { .casino-card-head, .card-body { grid-template-columns: 1fr; display: grid; } .casino-financials { grid-template-columns: repeat(2, minmax(0, 1fr)); justify-content: stretch; } .sort-panel { justify-items: start; } .sort-pills { justify-content: flex-start; } .quick-actions { justify-content: flex-start; } }
        @media (max-width: 640px) { .casino-financials { grid-template-columns: 1fr; } .quick-actions, .sort-pills { display: grid; } .action-link, .sort-pill { width: 100%; } .entry-row { grid-template-columns: 1fr; display: grid; } .entry-values { justify-items: start; text-align: left; } }
      `}</style>
    </div>
  );
}

function getTierBadgeStyle(tier: string) {
  if (tier === 'S') return { background: 'rgba(245, 158, 11, 0.16)', color: 'var(--accent-yellow)', borderColor: 'rgba(245, 158, 11, 0.32)' };
  if (tier === 'A') return { background: 'rgba(16, 185, 129, 0.16)', color: 'var(--accent-green)', borderColor: 'rgba(16, 185, 129, 0.32)' };
  if (tier === 'B') return { background: 'rgba(59, 130, 246, 0.16)', color: 'var(--accent-blue)', borderColor: 'rgba(59, 130, 246, 0.32)' };
  return { background: 'rgba(156, 163, 175, 0.12)', color: 'var(--text-secondary)', borderColor: 'rgba(156, 163, 175, 0.26)' };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatSc(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

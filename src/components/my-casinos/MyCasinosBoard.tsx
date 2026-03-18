import { useEffect, useMemo, useState } from 'react';

import { formatAgo, formatCurrency, formatDateTime, formatEntryType, formatSc, getTierBadgeStyle, riskRank } from '../../lib/format';
import HealthDetail from '../health/HealthDetail';
import HealthDot from '../health/HealthDot';

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
  health_status: string | null;
  health_reason: string | null;
  alert_count: number;
  promoban_risk: string | null;
  redemption_speed_desc: string | null;
  daily_bonus_desc: string | null;
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

type SortMode = 'risk' | 'last-activity' | 'name' | 'balance' | 'pl';
type ToastState = { tone: 'success' | 'error'; message: string } | null;

export default function MyCasinosBoard({ initialData }: MyCasinosBoardProps) {
  const [casinos, setCasinos] = useState(initialData.casinos);
  const [sortMode, setSortMode] = useState<SortMode>('risk');
  const [expandedCasinoId, setExpandedCasinoId] = useState<number | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<number, string>>(
    () => Object.fromEntries(initialData.casinos.map((casino) => [casino.casino_id, casino.notes])),
  );
  const [healthByCasino, setHealthByCasino] = useState<Record<number, { status: string; reason: string | null; warnings: unknown[]; personal_exposure?: unknown }>>({});
  const [loadingHealthId, setLoadingHealthId] = useState<number | null>(null);
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
      if (sortMode === 'balance') return b.sc_balance - a.sc_balance || b.usd_value - a.usd_value;
      if (sortMode === 'pl') return b.net_pl_usd - a.net_pl_usd;
      if (sortMode === 'last-activity') {
        return new Date(b.last_activity_at ?? 0).getTime() - new Date(a.last_activity_at ?? 0).getTime();
      }
      const riskDiff = riskRank(a.health_status) - riskRank(b.health_status);
      if (riskDiff !== 0) return riskDiff;
      return b.sc_balance - a.sc_balance || a.name.localeCompare(b.name);
    });
    return rows;
  }, [casinos, sortMode]);

  const expandedCasino = useMemo(
    () => sortedCasinos.find((casino) => casino.casino_id === expandedCasinoId) ?? null,
    [sortedCasinos, expandedCasinoId],
  );

  async function saveNotes(casinoId: number) {
    const nextValue = (draftNotes[casinoId] ?? '').trim();
    const currentValue = casinos.find((casino) => casino.casino_id === casinoId)?.notes.trim() ?? '';
    if (nextValue === currentValue) return;

    setSavingNotesId(casinoId);
    try {
      const response = await fetch('/api/v1/my-casinos/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casino_id: casinoId, notes: nextValue || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save notes.');
      setCasinos((current) =>
        current.map((casino) => (casino.casino_id === casinoId ? { ...casino, notes: data.notes ?? '' } : casino)),
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

  async function toggleExpanded(casinoId: number) {
    const nextExpanded = expandedCasinoId === casinoId ? null : casinoId;
    setExpandedCasinoId(nextExpanded);
    if (nextExpanded && !healthByCasino[casinoId]) {
      setLoadingHealthId(casinoId);
      try {
        const response = await fetch(`/api/v1/casinos/health-detail/${casinoId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Unable to load health detail.');
        setHealthByCasino((current) => ({ ...current, [casinoId]: data.detail }));
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingHealthId(null);
      }
    }
  }

  return (
    <div className="portfolio-shell">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}

      <section className="surface-card board-card">
        <div className="board-header">
          <div>
            <div className="eyebrow">Portfolio Health</div>
            <h1 className="section-title">My Casinos</h1>
            <p className="muted board-copy">Risk-first view of your balances, alerts, and operating posture.</p>
          </div>
          <div className="sort-panel">
            <span className="muted sort-label">Sort by</span>
            <div className="sort-pills">
              {([
                ['risk', 'Risk'],
                ['last-activity', 'Last Activity'],
                ['name', 'Name'],
                ['balance', 'Balance'],
                ['pl', 'P/L'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" className={`sort-pill ${sortMode === value ? 'sort-pill-active' : ''}`} onClick={() => setSortMode(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sortedCasinos.length === 0 ? (
          <div className="portfolio-empty">
            <p className="portfolio-empty-title">No casinos yet</p>
            <p className="muted" style={{ margin: 0 }}>
              You haven't added any casinos to your portfolio yet. Browse casinos to get started.
            </p>
            <a href="/casinos" className="subtle-link">Browse casinos</a>
          </div>
        ) : (
          <div className="card-list">
            {sortedCasinos.map((casino) => (
              <article key={casino.casino_id} className={`casino-card health-${casino.health_status ?? 'unknown'}`} id={`casino-${casino.casino_id}`}>
                <button type="button" className="casino-card-head" onClick={() => void toggleExpanded(casino.casino_id)}>
                  <div className="card-title-row">
                    <HealthDot status={casino.health_status} size={14} pulse={casino.health_status === 'critical'} />
                    <a href={`/casinos/${casino.slug}`} className="casino-name" onClick={(event) => event.stopPropagation()}>{casino.name}</a>
                    {casino.tier ? <span className="tier-badge" style={getTierBadgeStyle(casino.tier)}>{casino.tier}</span> : null}
                  </div>
                  <div className="mini-metrics">
                    <div className="mini-metric">
                      <span className="metric-label">SC Balance</span>
                      <strong>{formatSc(casino.sc_balance)}</strong>
                    </div>
                    <div className="mini-metric">
                      <span className="metric-label">Net P/L</span>
                      <strong className={casino.net_pl_usd >= 0 ? 'positive' : 'negative'}>{formatCurrency(casino.net_pl_usd)}</strong>
                    </div>
                    <div className="mini-metric">
                      <span className="metric-label">Last Activity</span>
                      <strong>{casino.last_activity_at ? formatAgo(casino.last_activity_at) : 'No entries yet'}</strong>
                    </div>
                    <div className="mini-metric">
                      <span className="metric-label">Alerts</span>
                      <strong>{casino.alert_count > 0 ? `${casino.alert_count} alerts` : 'No alerts'}</strong>
                    </div>
                  </div>
                </button>
              </article>
            ))}
          </div>
        )}

        {expandedCasino ? (
          <section className="expanded-panel">
            <div className="expanded-panel-header">
              <div className="expanded-title-row">
                <HealthDot status={expandedCasino.health_status} size={16} pulse={expandedCasino.health_status === 'critical'} />
                <h2 className="expanded-panel-title">{expandedCasino.name}</h2>
                {expandedCasino.tier ? <span className="tier-badge" style={getTierBadgeStyle(expandedCasino.tier)}>{expandedCasino.tier}</span> : null}
              </div>
              <button type="button" className="close-panel" onClick={() => setExpandedCasinoId(null)}>Close</button>
            </div>

            <section className="expanded-section">
              <h3 className="expanded-title">Financial Summary</h3>
              <div className="financial-grid">
                <div className="summary-chip"><span className="metric-label">SC Balance</span><strong>{formatSc(expandedCasino.sc_balance)}</strong></div>
                <div className="summary-chip"><span className="metric-label">USD Value</span><strong>{formatCurrency(expandedCasino.usd_value)}</strong></div>
                <div className="summary-chip"><span className="metric-label">Invested</span><strong>{formatCurrency(expandedCasino.total_invested_usd)}</strong></div>
                <div className="summary-chip"><span className="metric-label">Redeemed</span><strong>{formatCurrency(expandedCasino.total_redeemed_usd)}</strong></div>
              </div>
              <div className="entry-list">
                {expandedCasino.recent_entries.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="entry-row">
                    <div className="entry-copy">
                      <strong>{formatEntryType(entry.entry_type)}</strong>
                      <span className="muted">{entry.entry_at ? formatDateTime(entry.entry_at) : 'Unknown time'}</span>
                      {entry.notes ? <span className="muted">{entry.notes}</span> : null}
                    </div>
                    <div className="entry-values">
                      <span>{entry.sc_amount === null ? '--' : `${formatSc(entry.sc_amount)} SC`}</span>
                      <strong className={entry.usd_amount !== null && entry.usd_amount >= 0 ? 'positive' : 'negative'}>
                        {entry.usd_amount === null ? '--' : formatCurrency(entry.usd_amount)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
              <a href={`/ledger?casino_id=${expandedCasino.casino_id}`} className="subtle-link">View in Ledger</a>
            </section>

            <section className="expanded-section">
              <h3 className="expanded-title">Health Detail</h3>
              {loadingHealthId === expandedCasino.casino_id ? (
                <p className="muted">Loading health detail...</p>
              ) : healthByCasino[expandedCasino.casino_id] ? (
                <HealthDetail detail={healthByCasino[expandedCasino.casino_id]} />
              ) : (
                <p className="muted">No active health detail.</p>
              )}
            </section>

            <section className="expanded-section">
              <h3 className="expanded-title">Casino Quick Reference</h3>
              <div className="reference-grid">
                <div className="summary-chip"><span className="metric-label">Tier</span><strong>{expandedCasino.tier ?? '--'}</strong></div>
                <div className="summary-chip"><span className="metric-label">PB Risk</span><strong>{expandedCasino.promoban_risk ?? '--'}</strong></div>
                <div className="summary-chip"><span className="metric-label">Redeem Speed</span><strong>{expandedCasino.redemption_speed_desc ?? '--'}</strong></div>
                <div className="summary-chip"><span className="metric-label">Daily Bonus</span><strong>{expandedCasino.daily_bonus_desc ?? '--'}</strong></div>
              </div>
              <label className="notes-label" htmlFor={`notes-${expandedCasino.casino_id}`}>Personal notes</label>
              <textarea
                id={`notes-${expandedCasino.casino_id}`}
                value={draftNotes[expandedCasino.casino_id] ?? ''}
                placeholder="good wash games, slow redemptions, avoid deals here..."
                onChange={(event) => setDraftNotes((current) => ({ ...current, [expandedCasino.casino_id]: event.target.value }))}
                onBlur={() => void saveNotes(expandedCasino.casino_id)}
              />
              <span className="muted notes-hint">{savingNotesId === expandedCasino.casino_id ? 'Saving...' : 'Saves on blur'}</span>
            </section>

            <section className="expanded-section">
              <h3 className="expanded-title">Quick Actions</h3>
              <div className="quick-actions">
                <a href={`/dashboard#casino-${expandedCasino.casino_id}`} className="action-link action-primary">Claim Daily</a>
                <a href={`/dashboard#casino-${expandedCasino.casino_id}`} className="action-link">Log Purchase</a>
                <a href="/redemptions" className="action-link">Submit Redemption</a>
                {expandedCasino.visit_url ? <a href={expandedCasino.visit_url} className="action-link" target="_blank" rel="noopener noreferrer">Visit Casino</a> : null}
                <a href={`/casinos/${expandedCasino.slug}`} className="action-link action-secondary">View Profile</a>
              </div>
            </section>
          </section>
        ) : null}
      </section>

      <style>{`
        .portfolio-shell { display:grid; gap:1.25rem; }
        .board-card { display:grid; gap:1rem; padding:1.2rem; }
        .board-header { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; flex-wrap:wrap; }
        .board-copy { margin:0; max-width:44rem; line-height:1.65; }
        .sort-panel { display:grid; gap:0.55rem; justify-items:end; }
        .sort-label, .metric-label, .notes-label { color:var(--text-muted); font-size:.75rem; text-transform:uppercase; letter-spacing:.08em; font-weight:700; }
        .sort-pills { display:flex; gap:0.45rem; flex-wrap:wrap; justify-content:flex-end; }
        .sort-pill { border:1px solid var(--color-border); background:var(--bg-primary); color:var(--text-secondary); border-radius:999px; padding:0.58rem 0.82rem; font-weight:700; cursor:pointer; }
        .sort-pill-active { background:rgba(59,130,246,.14); color:var(--text-primary); border-color:rgba(59,130,246,.28); }
        .card-list { display:grid; gap:.9rem; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); }
        .portfolio-empty { display:grid; gap:.55rem; justify-items:start; padding:1.2rem; border:1px dashed var(--color-border-subtle); border-radius:1.25rem; text-align:left; }
        .portfolio-empty-title { margin:0; font-size:1.05rem; font-weight:800; }
        .casino-card { border:1px solid var(--color-border); border-radius:1.35rem; background:rgba(17, 24, 39, 0.54); overflow:hidden; }
        .casino-card-head { width:100%; border:none; background:transparent; color:inherit; padding:1rem 1.05rem; display:grid; gap:.95rem; cursor:pointer; text-align:left; }
        .card-title-row { display:flex; gap:.55rem; align-items:center; flex-wrap:wrap; }
        .casino-name { color:var(--text-primary); text-decoration:none; font-size:1.1rem; font-weight:800; letter-spacing:-.03em; }
        .tier-badge { display:inline-flex; min-width:2rem; justify-content:center; border-radius:999px; padding:.25rem .55rem; font-size:.78rem; font-weight:800; border:1px solid transparent; }
        .mini-metrics { display:grid; gap:.75rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .mini-metric { display:grid; gap:.18rem; padding:.7rem .8rem; border-radius:1rem; border:1px solid rgba(148,163,184,.14); background:rgba(15, 23, 42, 0.34); }
        .expanded-panel { display:grid; gap:1rem; padding:1.05rem; border:1px solid var(--color-border); border-radius:1.25rem; background:rgba(9, 14, 27, 0.72); }
        .expanded-panel-header { display:flex; justify-content:space-between; gap:1rem; align-items:center; flex-wrap:wrap; }
        .expanded-title-row { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; }
        .expanded-panel-title, .expanded-title { margin:0; }
        .expanded-section { display:grid; gap:.8rem; padding:1rem; border:1px solid var(--color-border); border-radius:1rem; background:rgba(15, 23, 42, 0.34); }
        .financial-grid, .reference-grid { display:grid; gap:.75rem; grid-template-columns:repeat(4, minmax(0, 1fr)); }
        .summary-chip { display:grid; gap:.2rem; min-width:118px; padding:.78rem .88rem; border-radius:1rem; border:1px solid var(--color-border); background:rgba(31, 41, 55, 0.68); }
        .entry-list { display:grid; gap:.65rem; }
        .entry-row { display:flex; justify-content:space-between; gap:.75rem; align-items:flex-start; padding:.8rem 0 0; border-top:1px solid rgba(156,163,175,.16); }
        .entry-copy, .entry-values { display:grid; gap:.18rem; }
        .entry-values { justify-items:end; text-align:right; }
        textarea { min-height:88px; resize:vertical; border-radius:1rem; border:1px solid var(--color-border); background:rgba(17, 24, 39, 0.82); color:var(--text-primary); padding:.85rem .95rem; line-height:1.5; }
        .notes-hint, .muted { color:var(--text-muted); }
        .quick-actions { display:flex; gap:.75rem; flex-wrap:wrap; align-items:center; }
        .action-link { display:inline-flex; align-items:center; justify-content:center; min-width:120px; text-decoration:none; border-radius:999px; padding:.78rem 1rem; border:1px solid var(--color-border); background:var(--bg-primary); color:var(--text-primary); font-weight:700; }
        .action-primary { background:rgba(16,185,129,.14); color:var(--accent-green); border-color:rgba(16,185,129,.28); }
        .action-secondary, .subtle-link, .close-panel { color:var(--text-secondary); }
        .subtle-link { text-decoration:none; font-weight:700; }
        .close-panel { border:1px solid var(--color-border); background:var(--bg-primary); border-radius:999px; padding:.55rem .85rem; font:inherit; font-weight:700; cursor:pointer; }
        .positive { color:var(--accent-green); }
        .negative { color:var(--accent-red); }
        .health-critical { box-shadow:0 0 0 1px rgba(244,63,94,.24), 0 12px 30px rgba(244,63,94,.08); }
        .toast { position:sticky; top:1rem; z-index:15; justify-self:center; padding:.8rem 1rem; border-radius:999px; font-weight:700; box-shadow:0 12px 30px rgba(0,0,0,.3); }
        .toast-success { background:rgba(16,185,129,.16); color:var(--accent-green); }
        .toast-error { background:rgba(239,68,68,.16); color:var(--accent-red); }
        @media (max-width: 960px) {
          .card-list { grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); }
          .financial-grid, .reference-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
          .sort-panel { justify-items:start; }
          .sort-pills { justify-content:flex-start; }
        }
        @media (max-width: 640px) {
          .card-list, .financial-grid, .reference-grid { grid-template-columns:1fr; }
          .quick-actions, .sort-pills { display:grid; }
          .action-link, .sort-pill { width:100%; }
          .entry-row { display:grid; }
          .entry-values { justify-items:start; text-align:left; }
        }
      `}</style>
    </div>
  );
}

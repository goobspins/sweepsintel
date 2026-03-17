import { useEffect, useState } from 'react';

import SignalCard from './SignalCard';
import SignalSubmitForm from './SignalSubmitForm';
import type { SignalItem, TrackedCasino } from './types';
import { useIntelFilters } from './useIntelFilters';
import { useSignalVoting } from './useSignalVoting';

interface IntelFeedProps {
  initialData: {
    items: SignalItem[];
    trackedCasinos: TrackedCasino[];
  };
}

type ToastState = { tone: 'success' | 'error'; message: string } | null;

export default function IntelFeed({ initialData }: IntelFeedProps) {
  const [items, setItems] = useState(initialData.items);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const { filters, setFilters, filteredItems, trackedCasinos, isPending } = useIntelFilters({
    items,
    trackedCasinos: initialData.trackedCasinos,
  });
  const { vote: handleVote } = useSignalVoting({
    setItems,
    onError: (error) => setToast({ tone: 'error', message: error.message }),
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!highlightedId) return;
    const timeout = window.setTimeout(() => setHighlightedId(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [highlightedId]);

  const subtitle =
    filters.selectedCasinoIds.length === 0
      ? 'No casinos selected — showing all signals'
      : `Tracking signals for ${filters.selectedCasinoIds.length} of ${trackedCasinos.length} casinos`;

  return (
    <div className="intel-shell">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}

      <section className="surface-card intel-hero">
        <div className="hero-copy">
          <h1 className="section-title">Intel</h1>
          <p className="muted hero-copy-text">{subtitle}</p>
        </div>
      </section>

      <section className="surface-card filter-bar">
        <div className="casino-chip-row" role="group" aria-label="Tracked casinos">
          {trackedCasinos.map((casino) => {
            const selected = filters.selectedCasinoIds.includes(casino.casino_id);
            return (
              <button
                key={casino.casino_id}
                type="button"
                className={`casino-chip ${selected ? 'casino-chip-selected' : ''}`}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    selectedCasinoIds: current.selectedCasinoIds.includes(casino.casino_id)
                      ? current.selectedCasinoIds.filter((value) => value !== casino.casino_id)
                      : [...current.selectedCasinoIds, casino.casino_id],
                  }))}
              >
                {casino.name}
              </button>
            );
          })}
        </div>
        <div className="filter-toolbar">
          <div className="select-row">
            <select value={filters.typeFilter} onChange={(event) => setFilters({ typeFilter: event.target.value })}>
              <option value="all">All Types</option>
              <option value="deals">Deals</option>
              <option value="promos">Promo Codes</option>
              <option value="free_sc">Free SC</option>
              <option value="warnings">Warnings</option>
              <option value="strategy">Strategy</option>
            </select>
            <select value={filters.timeFilter} onChange={(event) => setFilters({ timeFilter: event.target.value })}>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
              <option value="all">All time</option>
            </select>
          </div>
          <button type="button" className="submit-toggle" onClick={() => setShowSubmitForm((value) => !value)}>
            {showSubmitForm ? 'Cancel' : '+ Submit Signal'}
          </button>
        </div>
      </section>

      <div className={`submit-panel ${showSubmitForm ? 'submit-panel-open' : ''}`}>
        {showSubmitForm ? (
          <SignalSubmitForm
            casinos={trackedCasinos}
            onCreated={(signal) => {
              setItems((current) => [signal, ...current]);
              setHighlightedId(signal.id);
              setShowSubmitForm(false);
              setToast({ tone: 'success', message: 'Signal posted.' });
            }}
          />
        ) : null}
      </div>

      <section className="signal-section">
        <div className="signal-section-head">
          <strong>Showing {filteredItems.length} signals</strong>
          {isPending ? <span className="muted">Loading signals...</span> : null}
        </div>
        {filteredItems.length === 0 ? (
          <div className="empty-state surface-card">
            <p className="empty-title">Be the first to share intel</p>
            <p className="muted empty-copy">Signals for your tracked casinos will show up here as the community reports them.</p>
            <button type="button" className="empty-submit" onClick={() => setShowSubmitForm(true)}>+ Submit Signal</button>
          </div>
        ) : (
          <div className="signal-list">
            {filteredItems.map((item) => (
              <SignalCard key={item.id} item={item} onVote={handleVote} highlighted={highlightedId === item.id} />
            ))}
          </div>
        )}
      </section>

      <style>{`
        .intel-shell { display: grid; gap: 1rem; }
        .intel-hero { padding: 1.2rem; }
        .hero-copy { display: grid; gap: 0.35rem; }
        .hero-copy .section-title { margin: 0; }
        .hero-copy-text { margin: 0; line-height: 1.6; }
        .filter-bar {
          position: sticky;
          top: 0;
          z-index: 10;
          display: grid;
          gap: 0.9rem;
          padding: 1rem 1.2rem;
          backdrop-filter: blur(12px);
          background: rgba(17, 24, 39, 0.85);
          border-bottom: 1px solid var(--color-border);
        }
        .casino-chip-row { display: flex; gap: 0.55rem; flex-wrap: wrap; }
        .casino-chip {
          border: 1px solid var(--color-border);
          background: rgba(17, 24, 39, 0.58);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 0.58rem 0.82rem;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
        }
        .casino-chip-selected {
          background: rgba(59, 130, 246, 0.16);
          border-color: rgba(59, 130, 246, 0.28);
          color: var(--text-primary);
        }
        .filter-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .select-row { display: flex; gap: 0.65rem; flex-wrap: wrap; align-items: center; }
        .select-row select {
          border: 1px solid var(--color-border);
          border-radius: 999px;
          padding: 0.72rem 0.9rem;
          background: var(--bg-primary);
          color: var(--text-primary);
          font: inherit;
        }
        .submit-toggle, .empty-submit {
          border: none;
          border-radius: 999px;
          background: var(--accent-green);
          color: #0b1220;
          padding: 0.8rem 1rem;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .submit-panel {
          display: grid;
          overflow: hidden;
          transition: max-height 180ms ease, opacity 180ms ease;
          max-height: 0;
          opacity: 0;
        }
        .submit-panel-open { max-height: 1200px; opacity: 1; }
        .signal-section { display: grid; gap: 0.75rem; }
        .signal-section-head {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .signal-list { display: grid; gap: 1rem; }
        .empty-state {
          display: grid;
          gap: 0.6rem;
          justify-items: center;
          text-align: center;
          padding: 1.8rem 1.2rem;
          border: 1px dashed var(--color-border-subtle);
        }
        .empty-title { margin: 0; font-size: 1.1rem; font-weight: 800; }
        .empty-copy { margin: 0; max-width: 34rem; line-height: 1.65; }
        .toast {
          position: sticky;
          top: 1rem;
          z-index: 15;
          justify-self: center;
          padding: 0.8rem 1rem;
          border-radius: 999px;
          font-weight: 700;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
        }
        .toast-success { background: rgba(16, 185, 129, 0.16); color: var(--accent-green); }
        .toast-error { background: rgba(239, 68, 68, 0.16); color: var(--accent-red); }
        .muted { color: var(--text-muted); }
        @media (max-width: 640px) {
          .casino-chip-row {
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 0.1rem;
          }
          .filter-toolbar, .select-row { align-items: stretch; }
          .select-row, .submit-toggle, .empty-submit { width: 100%; }
          .select-row select { width: 100%; }
        }
      `}</style>
    </div>
  );
}

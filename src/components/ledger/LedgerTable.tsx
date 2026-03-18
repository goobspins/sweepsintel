import { useEffect, useMemo, useState } from 'react';

import {
  formatCurrencySigned,
  formatDate,
  formatEntryType,
  formatNumber,
  formatSignedNumber,
} from '../../lib/format';
import LedgerSummary from './LedgerSummary';
import ManualEntryForm from './ManualEntryForm';

interface LedgerEntryRow {
  id: number;
  casino_id: number;
  casino_name: string;
  entry_type: string;
  sc_amount: number | null;
  usd_amount: number | null;
  is_crypto: boolean;
  notes: string | null;
  source_redemption_id: number | null;
  source_claim_id: number | null;
  linked_entry_id: number | null;
  link_id: string | null;
  entry_at: string;
  entry_date: string;
}

interface DisplayLedgerEntryRow extends LedgerEntryRow {
  display_type: string;
  display_sc_amount: number | null;
  display_usd_amount: number | null;
  display_notes: string | null;
}

interface LedgerSummaryData {
  total_in_usd: number;
  total_out_usd: number;
  net_pl_usd: number;
  breakdown: Array<{
    casino_id: number;
    casino_name: string;
    net_usd: number;
    net_sc: number;
    available_sc: number;
  }>;
}

interface LedgerTableProps {
  initialData: {
    entries: LedgerEntryRow[];
    summary: LedgerSummaryData;
  };
  ledgerMode: 'simple' | 'advanced';
}

type ToastState = {
  tone: 'success' | 'error';
  message: string;
} | null;

export default function LedgerTable({ initialData, ledgerMode }: LedgerTableProps) {
  const [entries, setEntries] = useState(initialData.entries);
  const [summary, setSummary] = useState(initialData.summary);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [filters, setFilters] = useState({
    casino_id: '',
    entry_type: '',
    date_from: '',
    date_to: '',
  });
  const displayEntries = useMemo(() => groupLedgerEntries(entries), [entries]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function refreshSummary() {
    const response = await fetch('/api/v1/ledger/summary');
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to load ledger summary.');
    }
    setSummary(data);
  }

  async function loadEntries(nextPage = 1, append = false) {
    const params = new URLSearchParams();
    params.set('page', String(nextPage));
    if (filters.casino_id) params.set('casino_id', filters.casino_id);
    if (filters.entry_type) params.set('entry_type', filters.entry_type);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);

    const response = await fetch(`/api/v1/ledger/entries?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to load ledger entries.');
    }

    const nextEntries = data.entries ?? [];
    setEntries((current) => append ? [...current, ...nextEntries] : nextEntries);
    setPage(nextPage);
  }

  async function applyFilters() {
    try {
      await loadEntries(1, false);
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to apply filters.' });
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      await loadEntries(page + 1, true);
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to load more entries.' });
    } finally {
      setLoadingMore(false);
    }
  }

  async function refreshAfterCreate() {
    await Promise.all([loadEntries(1, false), refreshSummary()]);
    setToast({ tone: 'success', message: 'Ledger entry saved.' });
  }

  function handleExportCsv() {
    window.location.assign('/api/v1/ledger/export-csv');
  }

  const casinoOptions = summary.breakdown;

  return (
    <div className="ledger-shell">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}

      <LedgerSummary summary={summary} />

      <section className="surface-card ledger-card">
        <div className="toolbar">
          <div>
            <h1 className="section-title">Ledger</h1>
            <p className="muted">Money in minus money out. No tax math, just the transaction record.</p>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="ghost-button" onClick={handleExportCsv}>Export CSV</button>
            <button type="button" onClick={() => setShowForm(true)}>Add Entry</button>
          </div>
        </div>

        <div className="filters">
          <select
            value={filters.casino_id}
            onChange={(event) => setFilters((current) => ({ ...current, casino_id: event.target.value }))}
          >
            <option value="">All casinos</option>
            {casinoOptions.map((casino) => (
              <option key={casino.casino_id} value={casino.casino_id}>{casino.casino_name}</option>
            ))}
          </select>

          <select
            value={filters.entry_type}
            onChange={(event) => setFilters((current) => ({ ...current, entry_type: event.target.value }))}
          >
            <option value="">All types</option>
            {['daily', 'free_sc', 'purchase', 'purchase_credit', 'adjustment', 'redeem_confirmed'].map((entryType) => (
              <option key={entryType} value={entryType}>{entryType}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.date_from}
            onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))}
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))}
          />
          <button type="button" onClick={() => void applyFilters()}>Apply</button>
        </div>

        <div className="table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Casino</th>
                <th>Type</th>
                <th>SC</th>
                <th>USD</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.entry_at)}</td>
                  <td>{entry.casino_name}</td>
                  <td>{formatEntryType(entry.display_type)}</td>
                  <td className={getAmountTone(entry.display_sc_amount)}>
                    {entry.display_sc_amount === null ? '--' : formatSignedNumber(entry.display_sc_amount)}
                  </td>
                  <td className={getAmountTone(entry.display_usd_amount)}>
                    {entry.display_usd_amount === null ? '--' : formatCurrencySigned(entry.display_usd_amount)}
                  </td>
                  <td>{entry.display_notes ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="load-more">
          <button type="button" className="ghost-button" onClick={() => void handleLoadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      </section>

      {showForm ? (
        <ManualEntryForm
          ledgerMode={ledgerMode}
          onClose={() => setShowForm(false)}
          onSuccess={refreshAfterCreate}
        />
      ) : null}

      <style>{`
        .ledger-shell {
          display: grid;
          gap: 1.5rem;
        }

        .ledger-card {
          display: grid;
          gap: 1rem;
          padding: 1.25rem;
        }

        .toolbar,
        .toolbar-actions,
        .filters,
        .load-more {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
        }

        .toolbar p,
        .toolbar h1 {
          margin: 0;
        }

        .toolbar-actions button,
        .filters button,
        .ghost-button {
          border: none;
          border-radius: 999px;
          padding: 0.85rem 1rem;
          background: var(--color-primary);
          color: var(--text-primary);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .ghost-button {
          background: var(--color-surface);
          color: var(--color-ink);
          border: 1px solid var(--color-border);
        }

        .filters select,
        .filters input {
          border: 1px solid var(--color-border);
          border-radius: 999px;
          padding: 0.85rem 1rem;
          font: inherit;
          background: var(--color-surface);
        }

        .table-wrap {
          overflow-x: auto;
        }

        .ledger-table {
          width: 100%;
          border-collapse: collapse;
        }

        .ledger-table tbody tr:nth-child(odd) {
          background: rgba(17, 24, 39, 0.38);
        }

        .ledger-table tbody tr:nth-child(even) {
          background: rgba(17, 24, 39, 0.52);
        }

        .ledger-table th,
        .ledger-table td {
          padding: 0.85rem;
          border-bottom: 1px solid var(--color-border);
          text-align: left;
          vertical-align: top;
        }

        .amount-positive { color: var(--accent-green); font-weight: 700; }
        .amount-negative { color: var(--accent-red); font-weight: 700; }

        .toast {
          position: sticky;
          top: 1rem;
          z-index: 20;
          justify-self: center;
          padding: 0.85rem 1rem;
          border-radius: 999px;
          font-weight: 700;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
        }

        .toast-success { background: rgba(16, 185, 129, 0.16); color: var(--accent-green); }
        .toast-error { background: rgba(239, 68, 68, 0.16); color: var(--accent-red); }
      `}</style>
    </div>
  );
}

function groupLedgerEntries(entries: LedgerEntryRow[]): DisplayLedgerEntryRow[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const skipped = new Set<number>();
  const grouped: DisplayLedgerEntryRow[] = [];

  for (const entry of entries) {
    if (skipped.has(entry.id)) {
      continue;
    }

    if (entry.entry_type === 'purchase' && entry.linked_entry_id) {
      const linked = byId.get(entry.linked_entry_id);
      if (linked?.entry_type === 'purchase_credit') {
        skipped.add(linked.id);
        grouped.push({
          ...entry,
          display_type: 'purchase',
          display_sc_amount: linked.sc_amount,
          display_usd_amount: entry.usd_amount,
          display_notes: `Purchase: ${formatCurrencySigned(entry.usd_amount ?? 0)} USD -> +${formatNumber(linked.sc_amount ?? 0)} SC`,
        });
        continue;
      }
    }

    if (entry.entry_type === 'purchase_credit' && entry.linked_entry_id) {
      const linked = byId.get(entry.linked_entry_id);
      if (linked?.entry_type === 'purchase') {
        continue;
      }
    }

    grouped.push({
      ...entry,
      display_type: entry.entry_type,
      display_sc_amount: entry.sc_amount,
      display_usd_amount: entry.usd_amount,
      display_notes: entry.notes,
    });
  }

  return grouped;
}

function getAmountTone(value: number | null) {
  if (value === null || value === 0) return '';
  return value > 0 ? 'amount-positive' : 'amount-negative';
}


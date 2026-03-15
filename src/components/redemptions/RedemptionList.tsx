import { useEffect, useMemo, useState } from 'react';

import InTransitBanner from './InTransitBanner';
import RedemptionForm from './RedemptionForm';

export interface RedemptionRow {
  id: number;
  casino_id: number;
  casino_name: string;
  slug: string;
  sc_to_usd_ratio: number | null;
  sc_amount: number;
  usd_amount: number;
  fees_usd: number;
  method: string;
  is_crypto: boolean;
  bank_note: string | null;
  status: 'pending' | 'received' | 'cancelled' | 'rejected' | 'draft';
  notes: string | null;
  submitted_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  average_days: number | null;
  p80_days: number | null;
  trend_warning: boolean;
  sample_count: number;
}

interface RedemptionListProps {
  initialData: {
    redemptions: RedemptionRow[];
    inTransitTotalUsd: number;
    pendingCount: number;
  };
}

type ToastState = {
  tone: 'success' | 'error';
  message: string;
} | null;

export default function RedemptionList({ initialData }: RedemptionListProps) {
  const [redemptions, setRedemptions] = useState(initialData.redemptions);
  const [inTransitTotalUsd, setInTransitTotalUsd] = useState(initialData.inTransitTotalUsd);
  const [pendingCount, setPendingCount] = useState(initialData.pendingCount);
  const [filter, setFilter] = useState<'all' | RedemptionRow['status']>('all');
  const [showForm, setShowForm] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filtered = useMemo(() => (
    filter === 'all'
      ? redemptions
      : redemptions.filter((redemption) => redemption.status === filter)
  ), [filter, redemptions]);

  async function refreshList() {
    const response = await fetch('/api/redemptions/list');
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to refresh redemptions.');
    }

    setRedemptions(data.redemptions ?? []);
    setInTransitTotalUsd(Number(data.in_transit_total_usd ?? 0));
    setPendingCount(Number(data.pending_count ?? 0));
  }

  async function handleStatusUpdate(redemption: RedemptionRow, action: 'received' | 'cancelled' | 'rejected') {
    const prompt = action === 'received'
      ? `Confirm you received ${formatCurrency(redemption.usd_amount)} from ${redemption.casino_name}?`
      : action === 'cancelled'
        ? 'Cancel this redemption? SC will be restored to your balance.'
        : 'Mark this redemption as rejected? Casino rejected this redemption.';

    if (!window.confirm(prompt)) {
      return;
    }

    setLoadingActionId(redemption.id);
    try {
      const response = await fetch('/api/redemptions/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redemption_id: redemption.id,
          action,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to update redemption.');
      }

      await refreshList();
      setToast({
        tone: 'success',
        message:
          action === 'received'
            ? 'Redemption marked received.'
            : action === 'cancelled'
              ? 'Redemption cancelled.'
              : 'Redemption marked rejected.',
      });
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to update redemption.' });
    } finally {
      setLoadingActionId(null);
    }
  }

  return (
    <div className="redemptions-shell">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}

      <section className="surface-card section-card">
        <div className="section-head">
          <div>
            <h1 className="section-title">Redemption Tracker</h1>
            <p className="muted">Track pending cashouts and confirm them only when the money lands.</p>
          </div>
          <button type="button" onClick={() => setShowForm(true)}>New Redemption</button>
        </div>

        <InTransitBanner totalUsd={inTransitTotalUsd} pendingCount={pendingCount} />

        <div className="filter-bar">
          {(['all', 'pending', 'received', 'cancelled', 'rejected'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'filter-chip active' : 'filter-chip'}
              onClick={() => setFilter(value)}
            >
              {capitalize(value)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No redemptions match this filter yet.</p>
          </div>
        ) : (
          <div className="redemption-list">
            {filtered.map((redemption) => (
              <article key={redemption.id} className="redemption-card">
                <div className="card-head">
                  <div>
                    <h2>{redemption.casino_name}</h2>
                    <p className="muted">
                      {formatCurrency(redemption.usd_amount)} via {formatMethod(redemption.method)} - {relativeTime(redemption.submitted_at)}
                    </p>
                  </div>
                  <span className={`status-pill status-${redemption.status}`}>{statusLabel(redemption.status)}</span>
                </div>

                <div className="stats-grid">
                  <div><strong>SC</strong><span>{formatSc(redemption.sc_amount)} SC</span></div>
                  <div><strong>Gross USD</strong><span>{formatCurrency(redemption.usd_amount)}</span></div>
                  <div><strong>Fees</strong><span>{formatCurrency(redemption.fees_usd)}</span></div>
                  <div>
                    <strong>Avg time</strong>
                    <span>
                      {redemption.average_days !== null
                        ? `${redemption.average_days.toFixed(1)} days`
                        : 'Insufficient data'}
                    </span>
                  </div>
                </div>

                {redemption.status === 'pending' && redemption.trend_warning ? (
                  <div className="warning-banner">
                    Processing times at {redemption.casino_name} appear to be increasing recently.
                  </div>
                ) : null}

                {redemption.notes ? <p className="muted notes">{redemption.notes}</p> : null}

                {redemption.status === 'pending' ? (
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => void handleStatusUpdate(redemption, 'received')}
                      disabled={loadingActionId === redemption.id}
                    >
                      {loadingActionId === redemption.id ? 'Saving...' : 'Mark Received'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleStatusUpdate(redemption, 'cancelled')}
                      disabled={loadingActionId === redemption.id}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void handleStatusUpdate(redemption, 'rejected')}
                      disabled={loadingActionId === redemption.id}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {showForm ? (
        <RedemptionForm
          onClose={() => setShowForm(false)}
          onSuccess={refreshList}
        />
      ) : null}

      <style>{`
        .redemptions-shell {
          display: grid;
          gap: 1.5rem;
        }

        .section-card {
          display: grid;
          gap: 1rem;
          padding: 1.25rem;
        }

        .section-head,
        .card-head,
        .actions {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .section-head p,
        .card-head p,
        .card-head h2,
        .notes {
          margin: 0;
        }

        .section-head button,
        .actions button,
        .filter-chip {
          border: none;
          border-radius: 999px;
          padding: 0.85rem 1rem;
          background: var(--color-primary);
          color: #fff;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .filter-bar {
          display: flex;
          gap: 0.65rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
        }

        .filter-chip {
          background: #fff;
          color: var(--color-muted);
          border: 1px solid var(--color-border);
        }

        .filter-chip.active {
          background: var(--color-primary);
          color: #fff;
          border-color: var(--color-primary);
        }

        .redemption-list {
          display: grid;
          gap: 1rem;
        }

        .redemption-card {
          display: grid;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid var(--color-border);
          border-radius: 1.25rem;
          background: #fff;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .stats-grid div {
          display: grid;
          gap: 0.25rem;
          padding: 0.8rem;
          border-radius: 1rem;
          background: #f8fafc;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0.4rem 0.8rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-pending { background: #fff7ed; color: #9a3412; }
        .status-received { background: #ecfdf5; color: #166534; }
        .status-cancelled { background: #f3f4f6; color: #4b5563; }
        .status-rejected { background: #fef2f2; color: #991b1b; }
        .status-draft { background: #eff6ff; color: #1d4ed8; }

        .ghost-button {
          background: #fff !important;
          color: var(--color-ink) !important;
          border: 1px solid var(--color-border) !important;
        }

        .danger-button {
          background: #dc2626 !important;
        }

        .warning-banner {
          border: 1px solid rgba(217, 119, 6, 0.25);
          background: #fff7ed;
          color: #9a3412;
          border-radius: 1rem;
          padding: 0.85rem 1rem;
          font-weight: 600;
        }

        .empty-state {
          padding: 1.2rem;
          border-radius: 1rem;
          border: 1px dashed var(--color-border);
          color: var(--color-muted);
        }

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

        .toast-success { background: #ecfdf5; color: #065f46; }
        .toast-error { background: #fef2f2; color: #991b1b; }
      `}</style>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatSc(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMethod(method: string) {
  if (method === 'gift_card') {
    return 'Gift Card';
  }
  return method.toUpperCase();
}

function statusLabel(status: RedemptionRow['status']) {
  if (status === 'pending') return 'Pending';
  if (status === 'received') return 'Received';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'rejected') return 'Rejected';
  return 'Draft';
}

function relativeTime(timestamp: string) {
  const diffMs = new Date(timestamp).getTime() - Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffMs) >= dayMs) return formatter.format(Math.round(diffMs / dayMs), 'day');
  if (Math.abs(diffMs) >= hourMs) return formatter.format(Math.round(diffMs / hourMs), 'hour');
  return formatter.format(Math.round(diffMs / minuteMs), 'minute');
}

import { useEffect, useState } from 'react';

interface TrackedCasinoOption {
  casino_id: number;
  name: string;
}

interface TrackerStatusCasino {
  casino_id: number;
  name: string;
}

interface TrackerStatusResponse {
  casinos?: TrackerStatusCasino[];
  error?: string;
}

interface ManualEntryFormProps {
  ledgerMode: 'simple' | 'advanced';
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export default function ManualEntryForm({
  ledgerMode,
  onClose,
  onSuccess,
}: ManualEntryFormProps) {
  const [casinos, setCasinos] = useState<TrackedCasinoOption[]>([]);
  const [loadingCasinos, setLoadingCasinos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    casino_id: '',
    entry_type: ledgerMode === 'simple' ? 'adjustment' : 'daily',
    sc_amount: '',
    usd_amount: '',
    is_crypto: false,
    notes: '',
    link_id: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCasinos() {
      try {
        const response = await fetch('/api/v1/tracker/status');
        const data = (await response.json()) as TrackerStatusResponse;
        if (!response.ok) {
          throw new Error(data.error ?? 'Unable to load tracked casinos.');
        }
        if (!cancelled) {
          setCasinos((data.casinos ?? []).map((casino) => ({
            casino_id: casino.casino_id,
            name: casino.name,
          })));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load tracked casinos.');
        }
      } finally {
        if (!cancelled) {
          setLoadingCasinos(false);
        }
      }
    }

    void loadCasinos();

    return () => {
      cancelled = true;
    };
  }, []);

  const entryTypes = ledgerMode === 'simple'
    ? ['adjustment', 'offer']
    : ['daily', 'offer', 'winnings', 'wager', 'adjustment'];

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/ledger/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: Number(form.casino_id),
          entry_type: form.entry_type,
          sc_amount: ledgerMode === 'advanced' && form.sc_amount !== '' ? Number(form.sc_amount) : null,
          usd_amount: form.usd_amount !== '' ? Number(form.usd_amount) : null,
          is_crypto: form.is_crypto,
          notes: form.notes || null,
          link_id: ledgerMode === 'advanced' ? form.link_id || null : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save ledger entry.');
      }

      await onSuccess();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save ledger entry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h2>Add Entry</h2>
          <button type="button" className="ghost-button" onClick={onClose}>Close</button>
        </div>

        {loadingCasinos ? <p className="muted">Loading tracked casinos...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="form-grid">
          <label>
            Casino
            <select
              value={form.casino_id}
              onChange={(event) => setForm((current) => ({ ...current, casino_id: event.target.value }))}
            >
              <option value="">Select a casino</option>
              {casinos.map((casino) => (
                <option key={casino.casino_id} value={casino.casino_id}>{casino.name}</option>
              ))}
            </select>
          </label>

          <label>
            Entry Type
            <select
              value={form.entry_type}
              onChange={(event) => setForm((current) => ({ ...current, entry_type: event.target.value }))}
            >
              {entryTypes.map((entryType) => (
                <option key={entryType} value={entryType}>{entryType}</option>
              ))}
            </select>
          </label>

          {ledgerMode === 'advanced' ? (
            <label>
              SC Amount
              <input
                type="number"
                step="0.01"
                value={form.sc_amount}
                onChange={(event) => setForm((current) => ({ ...current, sc_amount: event.target.value }))}
              />
            </label>
          ) : null}

          <label>
            USD Amount
            <input
              type="number"
              step="0.01"
              value={form.usd_amount}
              onChange={(event) => setForm((current) => ({ ...current, usd_amount: event.target.value }))}
            />
          </label>

          {ledgerMode === 'advanced' ? (
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={form.is_crypto}
                onChange={(event) => setForm((current) => ({ ...current, is_crypto: event.target.checked }))}
              />
              Crypto settlement
            </label>
          ) : null}

          <label>
            Notes
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          {ledgerMode === 'advanced' ? (
            <label>
              Link ID
              <input
                type="text"
                value={form.link_id}
                onChange={(event) => setForm((current) => ({ ...current, link_id: event.target.value }))}
              />
            </label>
          ) : null}
        </div>

        <div className="actions">
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!form.casino_id || submitting}
          >
            {submitting ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: grid;
          align-items: end;
          z-index: 40;
          padding: 1rem;
        }

        .modal-card {
          width: min(100%, 34rem);
          margin: 0 auto;
          border-radius: 1.5rem 1.5rem 0 0;
          background: var(--color-surface);
          padding: 1.25rem;
          display: grid;
          gap: 1rem;
        }

        .modal-header,
        .actions {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .modal-header h2,
        .error-text {
          margin: 0;
        }

        .form-grid {
          display: grid;
          gap: 1rem;
        }

        .form-grid label {
          display: grid;
          gap: 0.45rem;
          font-weight: 600;
        }

        .inline-toggle {
          display: flex !important;
          gap: 0.5rem;
          align-items: center;
        }

        .form-grid input,
        .form-grid select,
        .form-grid textarea {
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          padding: 0.85rem 0.95rem;
          font: inherit;
        }

        .actions button {
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
          border: 1px solid var(--color-border) !important;
        }

        .error-text {
          color: var(--color-danger);
          font-weight: 600;
        }

        @media (min-width: 768px) {
          .modal-backdrop {
            align-items: center;
          }

          .modal-card {
            border-radius: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}


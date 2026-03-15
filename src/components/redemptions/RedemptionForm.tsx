import { useEffect, useMemo, useState } from 'react';

interface TrackedCasinoOption {
  casino_id: number;
  name: string;
  sc_to_usd_ratio: number | string | null;
}

interface RedemptionFormProps {
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export default function RedemptionForm({ onClose, onSuccess }: RedemptionFormProps) {
  const [casinos, setCasinos] = useState<TrackedCasinoOption[]>([]);
  const [loadingCasinos, setLoadingCasinos] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    casino_id: '',
    sc_amount: '',
    usd_amount: '',
    fees_usd: '0',
    method: 'ach',
    bank_note: '',
    notes: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCasinos() {
      try {
        const response = await fetch('/api/tracker/status');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Unable to load casinos.');
        }
        if (cancelled) {
          return;
        }

        const options = (data.casinos ?? []).map((casino: any) => ({
          casino_id: casino.casino_id,
          name: casino.name,
          sc_to_usd_ratio: casino.sc_to_usd_ratio,
        }));
        setCasinos(options);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load casinos.');
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

  const selectedCasino = useMemo(
    () => casinos.find((casino) => String(casino.casino_id) === form.casino_id) ?? null,
    [casinos, form.casino_id],
  );

  const suggestedUsd = useMemo(() => {
    const scAmount = Number(form.sc_amount);
    const ratio = Number(selectedCasino?.sc_to_usd_ratio);
    if (!Number.isFinite(scAmount) || scAmount <= 0 || !Number.isFinite(ratio) || ratio <= 0) {
      return null;
    }
    return scAmount / ratio;
  }, [form.sc_amount, selectedCasino]);

  function canConfirm() {
    return (
      form.casino_id &&
      Number.isFinite(Number(form.sc_amount)) &&
      Number(form.sc_amount) > 0 &&
      Number.isFinite(Number(form.usd_amount)) &&
      Number(form.usd_amount) > 0 &&
      Number.isFinite(Number(form.fees_usd)) &&
      Number(form.fees_usd) >= 0
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/redemptions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: Number(form.casino_id),
          sc_amount: Number(form.sc_amount),
          usd_amount: Number(form.usd_amount),
          fees_usd: Number(form.fees_usd),
          method: form.method,
          bank_note: form.bank_note || null,
          notes: form.notes || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to submit redemption.');
      }

      await onSuccess();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit redemption.');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h2>{confirming ? 'Confirm Redemption' : 'New Redemption'}</h2>
          <button type="button" className="ghost-button" onClick={onClose}>Close</button>
        </div>

        {loadingCasinos ? <p className="muted">Loading tracked casinos...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!confirming ? (
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
              SC Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.sc_amount}
                onChange={(event) => setForm((current) => ({ ...current, sc_amount: event.target.value }))}
              />
            </label>

            <label>
              USD Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.usd_amount}
                onChange={(event) => setForm((current) => ({ ...current, usd_amount: event.target.value }))}
              />
              {suggestedUsd !== null ? (
                <span className="hint">Suggested: {formatCurrency(suggestedUsd)}</span>
              ) : null}
            </label>

            <label>
              Processing fees (USD)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.fees_usd}
                onChange={(event) => setForm((current) => ({ ...current, fees_usd: event.target.value }))}
              />
            </label>

            <fieldset className="radio-group">
              <legend>Method</legend>
              {['ach', 'crypto', 'gift_card', 'other'].map((method) => (
                <label key={method}>
                  <input
                    type="radio"
                    name="method"
                    value={method}
                    checked={form.method === method}
                    onChange={(event) => setForm((current) => ({ ...current, method: event.target.value }))}
                  />
                  {formatMethod(method)}
                </label>
              ))}
            </fieldset>

            <label>
              Reference note for your records
              <input
                type="text"
                value={form.bank_note}
                onChange={(event) => setForm((current) => ({ ...current, bank_note: event.target.value }))}
              />
            </label>

            <label>
              Notes
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
          </div>
        ) : (
          <div className="confirm-panel">
            <p>
              Submit {formatCurrency(Number(form.usd_amount || 0))} redemption from {selectedCasino?.name ?? 'this casino'} via {formatMethod(form.method)}?
            </p>
            <div className="actions">
              <button type="button" className="ghost-button" onClick={() => setConfirming(false)} disabled={submitting}>
                Cancel
              </button>
              <button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {!confirming ? (
          <div className="actions">
            <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
            <button type="button" onClick={() => setConfirming(true)} disabled={!canConfirm() || loadingCasinos}>
              Continue
            </button>
          </div>
        ) : null}
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
          background: #fff;
          padding: 1.25rem;
          display: grid;
          gap: 1rem;
        }

        .modal-header,
        .actions {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .modal-header h2,
        .confirm-panel p {
          margin: 0;
        }

        .form-grid {
          display: grid;
          gap: 1rem;
        }

        .form-grid label,
        .radio-group {
          display: grid;
          gap: 0.45rem;
          margin: 0;
          font-weight: 600;
        }

        .form-grid input,
        .form-grid select,
        .form-grid textarea {
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          padding: 0.85rem 0.95rem;
          font: inherit;
        }

        .radio-group {
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          padding: 0.85rem 0.95rem;
        }

        .radio-group label {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          font-weight: 500;
        }

        .actions button {
          border: none;
          border-radius: 999px;
          padding: 0.85rem 1rem;
          background: var(--color-primary);
          color: #fff;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .ghost-button {
          background: #fff;
          color: var(--color-ink);
          border: 1px solid var(--color-border) !important;
        }

        .hint {
          color: var(--color-muted);
          font-size: 0.9rem;
          font-weight: 500;
        }

        .error-text {
          margin: 0;
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatMethod(method: string) {
  if (method === 'gift_card') {
    return 'Gift Card';
  }
  return method.toUpperCase();
}

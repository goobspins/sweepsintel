import { useState } from 'react';

interface StateReportFormProps {
  stateCode: string;
  stateName: string;
  casinos: Array<{ id: number; name: string }>;
  providers: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function StateReportForm({
  stateCode,
  stateName,
  casinos,
  providers,
  onClose,
  onSuccess,
}: StateReportFormProps) {
  const [mode, setMode] = useState<'casino' | 'provider'>('casino');
  const [casinoId, setCasinoId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [reportedStatus, setReportedStatus] = useState('restricted');
  const [reportText, setReportText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/reports/state-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: mode === 'casino' ? Number(casinoId) : null,
          provider_id: mode === 'provider' ? Number(providerId) : null,
          state_code: stateCode,
          reported_status: reportedStatus,
          report_text: reportText,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to submit state report.');
      }

      onSuccess(data.message);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to submit state report.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h2>Report a State Change for {stateName}</h2>
          <button type="button" className="ghost-button" onClick={onClose}>Close</button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="toggle-row">
            <button type="button" className={mode === 'casino' ? 'toggle-button active' : 'toggle-button'} onClick={() => setMode('casino')}>
              Casino
            </button>
            <button type="button" className={mode === 'provider' ? 'toggle-button active' : 'toggle-button'} onClick={() => setMode('provider')}>
              Provider
            </button>
          </div>

          {mode === 'casino' ? (
            <label>
              Casino
              <select value={casinoId} onChange={(event) => setCasinoId(event.target.value)} required>
                <option value="">Select a casino</option>
                {casinos.map((casino) => (
                  <option key={casino.id} value={casino.id}>{casino.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Provider
              <select value={providerId} onChange={(event) => setProviderId(event.target.value)} required>
                <option value="">Select a provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
              </select>
            </label>
          )}

          <fieldset className="radio-group">
            <legend>Reported status</legend>
            {[
              ['available', 'Available'],
              ['restricted', 'Restricted'],
              ['legal_but_pulled_out', 'Pulled Out'],
              ['operates_despite_restrictions', 'Operates Despite Restrictions'],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="reported_status"
                  value={value}
                  checked={reportedStatus === value}
                  onChange={(event) => setReportedStatus(event.target.value)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <label>
            Report text
            <textarea
              rows={5}
              value={reportText}
              onChange={(event) => setReportText(event.target.value)}
              minLength={20}
              required
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="actions">
            <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              disabled={
                pending ||
                reportText.trim().length < 20 ||
                (mode === 'casino' ? !casinoId : !providerId)
              }
            >
              {pending ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:grid; align-items:end; z-index:40; padding:1rem; }
        .modal-card { width:min(100%,34rem); margin:0 auto; border-radius:1.5rem 1.5rem 0 0; background:var(--color-surface); padding:1.25rem; display:grid; gap:1rem; }
        .modal-header, .actions, .toggle-row { display:flex; justify-content:space-between; gap:.75rem; align-items:center; flex-wrap:wrap; }
        .modal-header h2, .error-text { margin:0; }
        .form-grid { display:grid; gap:1rem; }
        .form-grid label, .radio-group { display:grid; gap:.45rem; margin:0; font-weight:600; }
        .form-grid select, .form-grid textarea { border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem; font:inherit; }
        .toggle-button, .actions button {
          border:none; border-radius:999px; padding:.85rem 1rem; background:var(--color-surface); color:var(--color-ink); font:inherit; font-weight:700; cursor:pointer; border:1px solid var(--color-border);
        }
        .toggle-button.active, .actions button:not(.ghost-button) { background:var(--color-primary); color:var(--text-primary); border-color:var(--color-primary); }
        .radio-group { border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem; }
        .radio-group label { display:flex; gap:.5rem; align-items:center; font-weight:500; }
        .ghost-button { background:var(--color-surface) !important; color:var(--color-ink) !important; border:1px solid var(--color-border) !important; }
        .error-text { color:var(--color-danger); font-weight:600; }
        @media (min-width: 768px) { .modal-backdrop { align-items:center; } .modal-card { border-radius:1.5rem; } }
      `}</style>
    </div>
  );
}


import { useState } from 'react';

interface BanReportFormProps {
  casinoId: number;
  casinoName: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function BanReportForm({
  casinoId,
  casinoName,
  onClose,
  onSuccess,
}: BanReportFormProps) {
  const [reportType, setReportType] = useState('promoban');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/reports/ban-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: casinoId,
          report_type: reportType,
          description,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to submit report.');
      }

      onSuccess(data.message);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to submit report.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h2>Report a Ban at {casinoName}</h2>
          <button type="button" className="ghost-button" onClick={onClose}>Close</button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <fieldset className="radio-group">
            <legend>Report type</legend>
            {[
              ['promoban', 'Promo Ban'],
              ['hardban', 'Hard Ban'],
              ['account_review', 'Account Review'],
              ['fund_confiscation', 'Fund Confiscation'],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="report_type"
                  value={value}
                  checked={reportType === value}
                  onChange={(event) => setReportType(event.target.value)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <label>
            Description
            <textarea
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={20}
              required
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="actions">
            <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={pending || description.trim().length < 20}>
              {pending ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:grid; align-items:end; z-index:40; padding:1rem; }
        .modal-card { width:min(100%,34rem); margin:0 auto; border-radius:1.5rem 1.5rem 0 0; background:var(--color-surface); padding:1.25rem; display:grid; gap:1rem; }
        .modal-header, .actions { display:flex; justify-content:space-between; gap:.75rem; align-items:center; flex-wrap:wrap; }
        .modal-header h2, .error-text { margin:0; }
        .form-grid { display:grid; gap:1rem; }
        .form-grid label, .radio-group { display:grid; gap:.45rem; margin:0; font-weight:600; }
        .form-grid textarea { border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem; font:inherit; }
        .radio-group { border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem; }
        .radio-group label { display:flex; gap:.5rem; align-items:center; font-weight:500; }
        .actions button { border:none; border-radius:999px; padding:.85rem 1rem; background:var(--color-primary); color:var(--text-primary); font:inherit; font-weight:700; cursor:pointer; }
        .ghost-button { background:var(--color-surface); color:var(--color-ink); border:1px solid var(--color-border) !important; }
        .error-text { color:var(--color-danger); font-weight:600; }
        @media (min-width: 768px) { .modal-backdrop { align-items:center; } .modal-card { border-radius:1.5rem; } }
      `}</style>
    </div>
  );
}


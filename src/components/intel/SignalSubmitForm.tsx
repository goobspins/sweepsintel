import { useState } from 'react';

import { SIGNAL_TYPE_LABELS } from '../../lib/intel-constants';
import type { SignalItem, TrackedCasino } from './types';

interface SignalSubmitFormProps {
  casinos: TrackedCasino[];
  onCreated: (signal: SignalItem) => void;
}

const DETAILS_MAX = 2000;

export default function SignalSubmitForm({ casinos, onCreated }: SignalSubmitFormProps) {
  const [casinoId, setCasinoId] = useState(String(casinos[0]?.casino_id ?? ''));
  const [signalType, setSignalType] = useState('general_tip');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/intel/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: Number(casinoId),
          signal_type: signalType,
          title,
          details,
          expires_at: expiresAt || null,
          is_anonymous: isAnonymous,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to submit signal.');
      onCreated(data.signal);
      setTitle('');
      setDetails('');
      setExpiresAt('');
      setIsAnonymous(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit signal.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="surface-card submit-form" onSubmit={handleSubmit}>
      <div className="form-copy">
        <div className="eyebrow">Share Intel</div>
        <h2 className="form-title">Share Intel</h2>
        <p className="muted form-subtitle">Help the community by reporting what you've found.</p>
      </div>

      <div className="field-grid">
        <label>
          <span className="metric-label">Casino</span>
          <select value={casinoId} onChange={(event) => setCasinoId(event.target.value)}>
            {casinos.map((casino) => (
              <option key={casino.casino_id} value={casino.casino_id}>
                {casino.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="metric-label">Signal Type</span>
          <select value={signalType} onChange={(event) => setSignalType(event.target.value)}>
            {Object.entries(SIGNAL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span className="metric-label">Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} />
      </label>

      <label>
        <div className="details-head">
          <span className="metric-label">Details</span>
          <span className="muted char-count">
            {details.length}/{DETAILS_MAX}
          </span>
        </div>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value.slice(0, DETAILS_MAX))}
        />
      </label>

      <div className="field-grid">
        <label>
          <span className="metric-label">Expiry</span>
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} />
          <span>Post anonymously</span>
        </label>
      </div>

      {error ? <div className="error-text">{error}</div> : null}

      <button type="submit" disabled={pending}>
        {pending ? 'Posting...' : 'Post signal'}
      </button>

      <style>{`
        .submit-form {
          display: grid;
          gap: 0.9rem;
          padding: 1.2rem;
          border-top: 3px solid var(--accent-green);
          background: rgba(17, 24, 39, 0.58);
        }
        .form-copy { display: grid; gap: 0.25rem; }
        .form-title { margin: 0; font-size: 1.4rem; }
        .form-subtitle { margin: 0; line-height: 1.55; }
        .field-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        label { display: grid; gap: 0.35rem; }
        .metric-label {
          color: var(--text-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }
        .details-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
        .char-count { font-size: 0.8rem; }
        input, select, textarea {
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          padding: 0.82rem 0.9rem;
          background: var(--bg-primary);
          color: var(--text-primary);
          font: inherit;
        }
        textarea { min-height: 140px; resize: vertical; }
        .checkbox-row { display: flex; gap: 0.5rem; align-items: center; }
        .checkbox-row input { width: auto; }
        button {
          border: none;
          border-radius: 999px;
          padding: 0.82rem 1rem;
          background: var(--accent-green);
          color: #0b1220;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .error-text { color: var(--accent-red); font-weight: 700; }
        .eyebrow { color: var(--text-muted); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
        .muted { color: var(--text-muted); }
        @media (max-width: 720px) { .field-grid { grid-template-columns: 1fr; } }
      `}</style>
    </form>
  );
}

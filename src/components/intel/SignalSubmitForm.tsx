import { useState } from 'react';

interface SignalSubmitFormProps {
  casinos: Array<{ casino_id: number; name: string }>;
  onCreated: (signal: any) => void;
}

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
    <form className="submit-form" onSubmit={handleSubmit}>
      <div className="field-grid">
        <label>
          <span>Casino</span>
          <select value={casinoId} onChange={(event) => setCasinoId(event.target.value)}>
            {casinos.map((casino) => (
              <option key={casino.casino_id} value={casino.casino_id}>{casino.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Signal type</span>
          <select value={signalType} onChange={(event) => setSignalType(event.target.value)}>
            {['free_sc', 'promo_code', 'flash_sale', 'playthrough_deal', 'platform_warning', 'general_tip'].map((value) => (
              <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        <span>Details</span>
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} />
      </label>
      <div className="field-grid">
        <label>
          <span>Expiry</span>
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} />
          <span>Post anonymously</span>
        </label>
      </div>
      {error ? <div className="error-text">{error}</div> : null}
      <button type="submit" disabled={pending}>{pending ? 'Posting...' : 'Post signal'}</button>
      <style>{`
        .submit-form { display:grid; gap:.85rem; padding:1rem; border:1px solid var(--color-border); border-radius:1rem; background:rgba(17, 24, 39, 0.42); }
        .field-grid { display:grid; gap:.75rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        label { display:grid; gap:.35rem; }
        span { font-weight:700; }
        input, select, textarea { border:1px solid var(--color-border); border-radius:1rem; padding:.82rem .9rem; background:var(--bg-primary); color:var(--text-primary); }
        textarea { min-height:110px; resize:vertical; }
        .checkbox-row { display:flex; gap:.5rem; align-items:center; }
        .checkbox-row input { width:auto; }
        button { border:none; border-radius:999px; padding:.82rem 1rem; background:var(--accent-green); color:#0b1220; font:inherit; font-weight:800; cursor:pointer; }
        .error-text { color:var(--accent-red); font-weight:700; }
        @media (max-width: 720px) { .field-grid { grid-template-columns:1fr; } }
      `}</style>
    </form>
  );
}

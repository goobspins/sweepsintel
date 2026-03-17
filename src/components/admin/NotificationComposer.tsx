import { useState } from 'react';

interface Option {
  id: number;
  name: string;
}

interface NotificationComposerProps {
  states: string[];
  casinos: Option[];
}

export default function NotificationComposer({
  states,
  casinos,
}: NotificationComposerProps) {
  const [segment, setSegment] = useState<'all' | 'state' | 'casino'>('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [stateCode, setStateCode] = useState(states[0] ?? '');
  const [casinoId, setCasinoId] = useState(casinos[0]?.id ?? 0);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch('/api/admin/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          action_url: actionUrl,
          segment,
          state_code: stateCode,
          casino_id: casinoId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to send notifications.');
      }
      window.alert('Notifications queued.');
      setTitle('');
      setMessage('');
      setActionUrl('');
    } catch (error) {
      console.error(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <label>
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <label>
        <span>Message</span>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} required />
      </label>
      <label>
        <span>Action URL</span>
        <input value={actionUrl} onChange={(event) => setActionUrl(event.target.value)} />
      </label>
      <label>
        <span>Segment</span>
        <select value={segment} onChange={(event) => setSegment(event.target.value as 'all' | 'state' | 'casino')}>
          <option value="all">All users</option>
          <option value="state">Users in state</option>
          <option value="casino">Users at casino</option>
        </select>
      </label>
      {segment === 'state' ? (
        <label>
          <span>State</span>
          <select value={stateCode} onChange={(event) => setStateCode(event.target.value)}>
            {states.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </label>
      ) : null}
      {segment === 'casino' ? (
        <label>
          <span>Casino</span>
          <select value={casinoId} onChange={(event) => setCasinoId(Number(event.target.value))}>
            {casinos.map((casino) => (
              <option key={casino.id} value={casino.id}>{casino.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="toggle">
        <input type="checkbox" />
        <span>Email blast toggle (confirmation comes later)</span>
      </label>
      <button type="submit" disabled={pending}>{pending ? 'Sending...' : 'Send notifications'}</button>
      <style>{`
        .composer {
          display: grid;
          gap: 1rem;
          padding: 1rem;
          border-radius: 1rem;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
        }
        label { display: grid; gap: 0.4rem; }
        input, textarea, select {
          border: 1px solid var(--color-border);
          border-radius: 0.9rem;
          padding: 0.85rem 0.95rem;
          font: inherit;
        }
        textarea { min-height: 8rem; resize: vertical; }
        .toggle { grid-template-columns: auto 1fr; align-items: center; gap: 0.75rem; }
        button {
          width: fit-content;
          border: none;
          border-radius: 999px;
          padding: 0.85rem 1rem;
          background: var(--color-primary);
          color: var(--text-primary);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
      `}</style>
    </form>
  );
}


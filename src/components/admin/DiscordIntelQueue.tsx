import { useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';

interface IntelItem {
  id: number;
  item_type: string;
  casino_name: string | null;
  casino_name_raw: string | null;
  title: string;
  content: string;
  source_channel: string | null;
  expires_at: string | null;
  confidence: string;
  confidence_reason: string | null;
  created_at: string;
}

interface DiscordIntelQueueProps {
  items: IntelItem[];
}

const confidenceColors: Record<string, string> = {
  high: 'var(--accent-green)',
  medium: 'var(--accent-yellow)',
  low: '#EA580C',
  unverified: 'var(--text-muted)',
};

export default function DiscordIntelQueue({ items }: DiscordIntelQueueProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = items[selectedIndex] ?? null;

  async function act(itemId: number, action: 'publish' | 'discard') {
    const response = await fetch('/api/admin/discord-intel-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, action }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to process intel item.');
    }
    window.location.reload();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!selected) {
        return;
      }

      if (event.key === 'n') {
        setSelectedIndex((current) => Math.min(items.length - 1, current + 1));
      } else if (event.key === 'p') {
        setSelectedIndex((current) => Math.max(0, current - 1));
      } else if (event.key === 'a') {
        void act(selected.id, 'publish');
      } else if (event.key === 'd') {
        void act(selected.id, 'discard');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items.length, selected]);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const order = ['high', 'medium', 'low', 'unverified'];
        const diff = order.indexOf(a.confidence) - order.indexOf(b.confidence);
        if (diff !== 0) {
          return diff;
        }
        return Date.parse(b.created_at) - Date.parse(a.created_at);
      }),
    [items],
  );

  return (
    <div className="queue-shell">
      {sorted.map((item, index) => (
        <article
          key={item.id}
          className={selected?.id === item.id ? 'queue-row selected' : 'queue-row'}
        >
          <div className="row-topline">
            <span
              className="badge"
              style={{
                background: `${confidenceColors[item.confidence] ?? 'var(--text-muted)'}1A`,
                color: confidenceColors[item.confidence] ?? 'var(--text-muted)',
              }}
            >
              {item.confidence}
            </span>
            <span className="badge neutral">{item.item_type.replace(/_/g, ' ')}</span>
            <span className="muted">{item.casino_name ?? item.casino_name_raw ?? 'General'}</span>
          </div>
          <strong>{item.title}</strong>
          {item.confidence_reason ? <div className="muted">{item.confidence_reason}</div> : null}
          <div className="muted">
            {renderExpiry(item.expires_at)} · {DateTime.fromISO(item.created_at).toRelative() ?? 'Now'}
          </div>
          <button
            type="button"
            className="raw-toggle"
            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
          >
            {expandedId === item.id ? 'Hide raw content' : 'Show raw content'}
          </button>
          {expandedId === item.id ? <pre>{item.content}</pre> : null}
          <div className="actions">
            <button type="button" onClick={() => void act(item.id, 'publish')}>
              Publish
            </button>
            <button type="button" className="ghost" onClick={() => void act(item.id, 'discard')}>
              Discard
            </button>
          </div>
        </article>
      ))}
      <div className="shortcut-bar">Keyboard: a publish · d discard · n next · p previous</div>
      <style>{`
        .queue-shell { display: grid; gap: 1rem; }
        .queue-row {
          display: grid;
          gap: 0.7rem;
          padding: 1rem;
          border-radius: 1rem;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
        }
        .selected { box-shadow: 0 0 0 2px rgba(37,99,235,.15); }
        .row-topline, .actions {
          display: flex;
          gap: 0.65rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .badge {
          border-radius: 999px;
          padding: 0.3rem 0.55rem;
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: capitalize;
        }
        .neutral { background: rgba(15,23,42,.06); color: var(--color-ink); }
        .raw-toggle {
          width: fit-content;
          border: none;
          background: transparent;
          padding: 0;
          color: var(--color-primary);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        pre {
          margin: 0;
          padding: 0.9rem;
          border-radius: 0.85rem;
          background: var(--bg-secondary);
          white-space: pre-wrap;
          font-family: ui-monospace, monospace;
        }
        .actions button {
          border: none;
          border-radius: 999px;
          padding: 0.75rem 0.95rem;
          background: var(--color-primary);
          color: var(--text-primary);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .actions .ghost {
          background: var(--color-surface);
          color: var(--color-ink);
          border: 1px solid var(--color-border);
        }
        .shortcut-bar {
          position: sticky;
          bottom: 1rem;
          padding: 0.85rem 1rem;
          border-radius: 999px;
          background: var(--bg-primary);
          color: var(--text-primary);
          width: fit-content;
          justify-self: end;
        }
      `}</style>
    </div>
  );
}

function renderExpiry(expiresAt: string | null) {
  if (!expiresAt) {
    return 'No expiry';
  }

  const expiry = DateTime.fromISO(expiresAt);
  if (!expiry.isValid) {
    return 'Invalid expiry';
  }

  const minutes = Math.ceil(expiry.diffNow('minutes').minutes);
  if (minutes <= 0) {
    return 'Expired';
  }
  if (minutes < 120) {
    return `Expires in ${minutes}m`;
  }

  return `Expires in ${Math.floor(minutes / 60)}h`;
}


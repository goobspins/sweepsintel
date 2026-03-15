import { useEffect, useState } from 'react';

interface FlagItem {
  id: number;
  source: string;
  flag_type: string;
  casino_name: string | null;
  state_code: string | null;
  flag_content: string;
  ai_summary: string | null;
  proposed_action: string | null;
  created_at: string;
}

interface FlagQueueProps {
  flags: FlagItem[];
}

const flagColors: Record<string, string> = {
  potential_pullout: 'var(--accent-red)',
  ban_surge: 'var(--accent-yellow)',
  redemption_slowdown: 'var(--accent-yellow)',
  data_anomaly: 'var(--text-muted)',
  new_casino_signal: 'var(--accent-blue)',
  premium_content_candidate: '#7C3AED',
  positive_redemption: 'var(--accent-green)',
  game_availability_change: '#EA580C',
  broken_platform_feature: 'var(--accent-red)',
};

export default function FlagQueue({ flags }: FlagQueueProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = flags[selectedIndex] ?? null;

  async function dismiss(flag: FlagItem) {
    const note = window.prompt('Dismiss note (optional):', '');
    const response = await fetch('/api/admin/flag-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flag_id: flag.id,
        action: 'dismiss',
        note,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to dismiss flag.');
    }
    window.location.reload();
  }

  async function act(flag: FlagItem) {
    let payload: Record<string, unknown> = { flag_id: flag.id, action: 'act' };

    if (flag.flag_type === 'potential_pullout') {
      payload = {
        ...payload,
        status: window.prompt('New state status:', 'legal_but_pulled_out'),
        note: window.prompt('Alert message:', flag.flag_content),
      };
    } else if (flag.flag_type === 'ban_surge') {
      payload = {
        ...payload,
        update_promoban_risk: true,
        promoban_risk: window.prompt('Promoban risk tier:', 'high'),
        create_ban_uptick_alert: window.confirm('Create ban uptick alert?'),
      };
    } else if (flag.flag_type === 'redemption_slowdown') {
      payload = {
        ...payload,
        redemption_speed_desc: window.prompt('Updated redemption speed description:', 'Processing times increasing'),
      };
    } else if (flag.flag_type === 'new_casino_signal') {
      payload = {
        ...payload,
        casino_name: window.prompt('Casino name:', flag.ai_summary ?? flag.flag_content),
      };
    } else if (flag.flag_type === 'premium_content_candidate') {
      payload = {
        ...payload,
        category: window.prompt('Premium content category:', 'cross-wash'),
      };
    } else if (flag.flag_type === 'game_availability_change') {
      payload = {
        ...payload,
        game_name: window.prompt('Game name to mark removed:'),
        confirm_removal: window.confirm('Confirm removal?'),
      };
    } else {
      payload = {
        ...payload,
        note: window.prompt('Action note:', flag.proposed_action ?? ''),
      };
    }

    const response = await fetch('/api/admin/flag-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to act on flag.');
    }

    if (data.redirect_id) {
      window.location.assign(`/admin/casinos/${data.redirect_id}`);
      return;
    }

    window.location.reload();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!selected) {
        return;
      }

      if (event.key === 'n') {
        setSelectedIndex((current) => Math.min(flags.length - 1, current + 1));
      } else if (event.key === 'p') {
        setSelectedIndex((current) => Math.max(0, current - 1));
      } else if (event.key === 'a') {
        void act(selected);
      } else if (event.key === 'd') {
        void dismiss(selected);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flags.length, selected]);

  return (
    <div className="queue-shell">
      {flags.map((flag) => (
        <article
          key={flag.id}
          className={selected?.id === flag.id ? 'queue-row selected' : 'queue-row'}
        >
          <div className="row-topline">
            <span className="badge neutral">{flag.source}</span>
            <span
              className="badge"
              style={{
                background: `${flagColors[flag.flag_type] ?? 'var(--text-muted)'}1A`,
                color: flagColors[flag.flag_type] ?? 'var(--text-muted)',
              }}
            >
              {flag.flag_type.replace(/_/g, ' ')}
            </span>
            {flag.casino_name ? <span className="muted">{flag.casino_name}</span> : null}
            {flag.state_code ? <span className="muted">{flag.state_code}</span> : null}
          </div>
          <strong>{flag.ai_summary ?? flag.flag_content}</strong>
          {flag.proposed_action ? <div className="muted">Proposed action: {flag.proposed_action}</div> : null}
          <button
            type="button"
            className="raw-toggle"
            onClick={() => setExpandedId(expandedId === flag.id ? null : flag.id)}
          >
            {expandedId === flag.id ? 'Hide raw content' : 'Show raw content'}
          </button>
          {expandedId === flag.id ? <pre>{flag.flag_content}</pre> : null}
          <div className="actions">
            <button type="button" onClick={() => void act(flag)}>Act</button>
            <button type="button" className="ghost" onClick={() => void dismiss(flag)}>Dismiss</button>
          </div>
        </article>
      ))}
      <div className="shortcut-bar">Keyboard: a act · d dismiss · n next · p previous</div>
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


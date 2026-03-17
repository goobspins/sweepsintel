import { useState } from 'react';

import HealthDot from '../health/HealthDot';

interface HealthOverridesProps {
  initialRows: Array<{
    casino_id: number;
    casino_name: string;
    admin_override_status: string | null;
    admin_override_reason: string | null;
    admin_override_at: string | null;
  }>;
  casinos: Array<{ id: number; name: string }>;
}

export default function HealthOverrides({ initialRows, casinos }: HealthOverridesProps) {
  const [rows, setRows] = useState(initialRows);
  const [casinoId, setCasinoId] = useState(String(casinos[0]?.id ?? ''));
  const [status, setStatus] = useState('watch');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  async function saveOverride(nextCasinoId: number, nextStatus: string | null, nextReason: string) {
    setPending(true);
    try {
      const response = await fetch('/api/admin/casino-health-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: nextCasinoId,
          status: nextStatus,
          reason: nextReason || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save override.');
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="override-shell">
      <form
        className="surface-card override-form"
        onSubmit={(event) => {
          event.preventDefault();
          void saveOverride(Number(casinoId), status, reason);
        }}
      >
        <h2 style={{ margin: 0 }}>Add Override</h2>
        <div className="field-grid">
          <select value={casinoId} onChange={(event) => setCasinoId(event.target.value)}>
            {casinos.map((casino) => (
              <option key={casino.id} value={casino.id}>{casino.name}</option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {['healthy', 'watch', 'at_risk', 'critical'].map((value) => (
              <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why are you pinning this status?" />
        <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save override'}</button>
      </form>

      <section className="surface-card override-table">
        <h2 style={{ margin: '0 0 1rem' }}>Active Overrides</h2>
        <table>
          <thead>
            <tr>
              <th>Casino</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Set At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.casino_id}>
                <td>{row.casino_name}</td>
                <td>
                  {row.admin_override_status ? (
                    <span className="status-cell">
                      <HealthDot status={row.admin_override_status} />
                      {row.admin_override_status.replace(/_/g, ' ')}
                    </span>
                  ) : '--'}
                </td>
                <td>{row.admin_override_reason ?? '--'}</td>
                <td>{row.admin_override_at ? new Date(row.admin_override_at).toLocaleString() : '--'}</td>
                <td>
                  {row.admin_override_status ? (
                    <button type="button" className="ghost-button" onClick={() => void saveOverride(row.casino_id, null, '')}>
                      Clear Override
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <style>{`
        .override-shell { display:grid; gap:1rem; }
        .override-form, .override-table { padding:1.1rem; }
        .field-grid { display:grid; gap:.75rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        select, textarea, button { font:inherit; }
        select, textarea { border:1px solid var(--color-border); border-radius:1rem; padding:.82rem .9rem; background:var(--bg-primary); color:var(--text-primary); }
        textarea { min-height:110px; resize:vertical; }
        button { border:none; border-radius:999px; padding:.82rem 1rem; background:var(--accent-blue); color:var(--text-primary); font-weight:700; cursor:pointer; }
        .ghost-button { background:transparent; border:1px solid var(--color-border); }
        table { width:100%; border-collapse:collapse; }
        th, td { padding:.85rem; border-bottom:1px solid var(--color-border); text-align:left; vertical-align:top; }
        .status-cell { display:inline-flex; gap:.45rem; align-items:center; }
      `}</style>
    </div>
  );
}

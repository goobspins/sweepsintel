import { useState } from 'react';

interface BanReport {
  id: number;
  casino_name: string | null;
  report_type: string;
  description: string;
  reporter_ip_hash: string | null;
  reporter_user_id: string | null;
}

interface StateReport {
  id: number;
  casino_name: string | null;
  state_code: string | null;
  reported_status: string;
  report_text: string;
  reporter_ip_hash: string | null;
  reporter_user_id: string | null;
}

interface ResetSuggestion {
  id: number;
  casino_name: string | null;
  suggested_reset_mode: string | null;
  suggested_reset_time: string | null;
  suggested_timezone: string | null;
  evidence_text: string | null;
  reporter_ip_hash: string | null;
  reporter_user_id: string | null;
}

interface ReportQueueProps {
  bans: BanReport[];
  states: StateReport[];
  resets: ResetSuggestion[];
}

export default function ReportQueue({ bans, states, resets }: ReportQueueProps) {
  const [tab, setTab] = useState<'bans' | 'states' | 'resets'>('bans');

  async function act(reportType: 'ban' | 'state' | 'reset', reportId: number, action: 'publish' | 'reject') {
    const response = await fetch('/api/admin/report-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_type: reportType,
        report_id: reportId,
        action,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to process report.');
    }
    window.location.reload();
  }

  const rows =
    tab === 'bans'
      ? bans.map((row) => ({
          id: row.id,
          title: `${row.casino_name ?? 'Unknown'} - ${row.report_type}`,
          body: row.description,
          meta: `${row.reporter_user_id ?? 'anon'} - ${row.reporter_ip_hash ?? 'no hash'}`,
          kind: 'ban' as const,
        }))
      : tab === 'states'
        ? states.map((row) => ({
            id: row.id,
            title: `${row.casino_name ?? 'Unknown'} - ${row.state_code ?? '--'} - ${row.reported_status}`,
            body: row.report_text,
            meta: `${row.reporter_user_id ?? 'anon'} - ${row.reporter_ip_hash ?? 'no hash'}`,
            kind: 'state' as const,
          }))
        : resets.map((row) => ({
            id: row.id,
            title: `${row.casino_name ?? 'Unknown'} - ${row.suggested_reset_mode ?? 'unknown'} @ ${row.suggested_reset_time ?? '--'}`,
            body: row.evidence_text ?? 'No evidence text',
            meta: `${row.reporter_user_id ?? 'anon'} - ${row.reporter_ip_hash ?? 'no hash'}`,
            kind: 'reset' as const,
          }));

  return (
    <div className="queue-shell">
      <div className="tabs">
        <button type="button" className={tab === 'bans' ? 'active' : ''} onClick={() => setTab('bans')}>Ban Reports</button>
        <button type="button" className={tab === 'states' ? 'active' : ''} onClick={() => setTab('states')}>State Reports</button>
        <button type="button" className={tab === 'resets' ? 'active' : ''} onClick={() => setTab('resets')}>Reset Suggestions</button>
      </div>
      {rows.map((row) => (
        <article key={`${row.kind}-${row.id}`} className="queue-row">
          <strong>{row.title}</strong>
          <p>{row.body}</p>
          <div className="muted">{row.meta}</div>
          <div className="actions">
            <button type="button" onClick={() => void act(row.kind, row.id, 'publish')}>Publish</button>
            <button type="button" className="ghost" onClick={() => void act(row.kind, row.id, 'reject')}>Reject</button>
          </div>
        </article>
      ))}
      <style>{`
        .queue-shell { display: grid; gap: 1rem; }
        .tabs, .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .tabs button, .actions button {
          border: 1px solid var(--color-border);
          border-radius: 999px;
          padding: 0.75rem 0.95rem;
          background: #fff;
          font: inherit;
          cursor: pointer;
        }
        .tabs .active, .actions button:first-child {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: #fff;
          font-weight: 700;
        }
        .ghost { color: var(--color-ink); }
        .queue-row {
          display: grid;
          gap: 0.65rem;
          padding: 1rem;
          border-radius: 1rem;
          border: 1px solid var(--color-border);
          background: #fff;
        }
        .queue-row p { margin: 0; line-height: 1.55; }
      `}</style>
    </div>
  );
}

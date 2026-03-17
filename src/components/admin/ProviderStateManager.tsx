interface ProviderStateRow {
  provider_id: number;
  provider_name: string;
  state_code: string;
  status: string;
}

interface ProviderStateManagerProps {
  rows: ProviderStateRow[];
}

const statusOptions = [
  'available',
  'restricted',
  'legal_but_pulled_out',
  'operates_despite_restrictions',
];

export default function ProviderStateManager({ rows }: ProviderStateManagerProps) {
  async function updateRow(row: ProviderStateRow, status: string) {
    const response = await fetch('/api/admin/provider-state-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_id: row.provider_id,
        state_code: row.state_code,
        status,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to update provider state.');
    }
    window.location.reload();
  }

  return (
    <div className="manager-shell">
      {rows.map((row) => (
        <article key={`${row.provider_id}-${row.state_code}`} className="manager-row">
          <strong>{row.provider_name}</strong>
          <span className="muted">{row.state_code}</span>
          <select
            value={row.status}
            onChange={(event) => void updateRow(row, event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </article>
      ))}
      <style>{`
        .manager-shell { display: grid; gap: 0.85rem; }
        .manager-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 1rem;
          align-items: center;
          padding: 1rem;
          border-radius: 1rem;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
        }
        select {
          border: 1px solid var(--color-border);
          border-radius: 999px;
          padding: 0.7rem 0.9rem;
          font: inherit;
        }
      `}</style>
    </div>
  );
}


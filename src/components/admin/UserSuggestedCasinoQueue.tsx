interface UserSuggestedCasino {
  id: number;
  name: string;
  slug: string;
  tracked_by_count: number;
  is_excluded: boolean;
}

interface UserSuggestedCasinoQueueProps {
  casinos: UserSuggestedCasino[];
}

export default function UserSuggestedCasinoQueue({
  casinos,
}: UserSuggestedCasinoQueueProps) {
  async function updateCasino(casinoId: number, patch: Record<string, unknown>) {
    const response = await fetch('/api/admin/casinos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: casinoId, ...patch }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to update casino.');
    }
  }

  return (
    <div className="queue-shell">
      {casinos.map((casino) => (
        <article key={casino.id} className="queue-row">
          <div>
            <strong>{casino.name}</strong>
            <div className="muted">{casino.tracked_by_count} users tracking this</div>
          </div>
          <div className="queue-actions">
            <button
              type="button"
              onClick={async () => {
                try {
                  await updateCasino(casino.id, { source: 'admin' });
                  window.location.assign(`/admin/casinos/${casino.id}`);
                } catch (error) {
                  console.error(error);
                }
              }}
            >
              Build Profile
            </button>
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                try {
                  await updateCasino(casino.id, { is_excluded: true });
                  window.location.reload();
                } catch (error) {
                  console.error(error);
                }
              }}
            >
              Exclude
            </button>
          </div>
        </article>
      ))}
      <style>{`
        .queue-shell {
          display: grid;
          gap: 0.85rem;
        }

        .queue-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          padding: 1rem;
          border-radius: 1rem;
          border: 1px solid var(--color-border);
          background: #fff;
        }

        .queue-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .queue-actions button {
          border: none;
          border-radius: 999px;
          padding: 0.75rem 0.95rem;
          background: var(--color-primary);
          color: #fff;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .queue-actions .ghost {
          background: #fff;
          color: var(--color-ink);
          border: 1px solid var(--color-border);
        }
      `}</style>
    </div>
  );
}

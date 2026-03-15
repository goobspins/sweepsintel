interface GameAvailabilityItem {
  id: number;
  game_name: string;
  provider_name: string | null;
  is_cross_wash_relevant: boolean;
  confidence: string;
}

interface GameAvailabilityTableProps {
  games: GameAvailabilityItem[];
}

const confidenceColors: Record<string, string> = {
  high: '#16A34A',
  medium: '#D97706',
  low: '#F97316',
  unverified: '#6B7280',
};

export default function GameAvailabilityTable({
  games,
}: GameAvailabilityTableProps) {
  if (games.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--color-muted)' }}>
        No game data yet - community monitoring will populate this over time.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Game', 'Provider', 'CW?', 'Confidence'].map((label) => (
              <th
                key={label}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem',
                  fontSize: '0.92rem',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id}>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
                {game.game_name}
              </td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
                {game.provider_name ?? 'Unknown'}
              </td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
                {game.is_cross_wash_relevant ? '✓' : '—'}
              </td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    padding: '0.3rem 0.55rem',
                    borderRadius: '999px',
                    background: `${confidenceColors[game.confidence] ?? '#6B7280'}1A`,
                    color: confidenceColors[game.confidence] ?? '#6B7280',
                    fontWeight: 700,
                    textTransform: 'capitalize',
                  }}
                >
                  {game.confidence}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

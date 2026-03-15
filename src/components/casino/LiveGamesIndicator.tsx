interface LiveGamesIndicatorProps {
  hasLiveGames: boolean;
}

export default function LiveGamesIndicator({
  hasLiveGames,
}: LiveGamesIndicatorProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        color: hasLiveGames ? 'var(--accent-green)' : 'var(--text-muted)',
        fontWeight: 600,
      }}
    >
      <span aria-hidden="true">{hasLiveGames ? '●' : '○'}</span>
      {hasLiveGames ? 'Live games' : 'No live games'}
    </span>
  );
}


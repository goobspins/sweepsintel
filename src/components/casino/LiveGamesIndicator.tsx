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
        color: hasLiveGames ? '#16A34A' : '#6B7280',
        fontWeight: 600,
      }}
    >
      <span aria-hidden="true">{hasLiveGames ? '●' : '○'}</span>
      {hasLiveGames ? 'Live games' : 'No live games'}
    </span>
  );
}

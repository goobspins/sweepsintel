interface VoteButtonsProps {
  itemType: string;
  workedCount: number;
  didntWorkCount: number;
  pendingVote?: 'worked' | 'didnt_work' | null;
  onVote: (vote: 'worked' | 'didnt_work') => void;
}

function formatVoteCount(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export default function VoteButtons({
  itemType,
  workedCount,
  didntWorkCount,
  pendingVote = null,
  onVote,
}: VoteButtonsProps) {
  const positiveLabel = itemType === 'platform_warning' ? 'Experiencing this' : 'Worked for me';
  const negativeLabel = itemType === 'platform_warning' ? 'Not affected' : "Didn't work";
  const totalVotes = workedCount + didntWorkCount;
  const positiveRatio = totalVotes > 0 ? (workedCount / totalVotes) * 100 : 50;

  return (
    <div className="vote-shell">
      {totalVotes > 5 ? (
        <div className="vote-ratio" aria-hidden="true">
          <span className="vote-ratio-positive" style={{ width: `${positiveRatio}%` }} />
        </div>
      ) : null}
      <div className="vote-buttons">
        <button
          type="button"
          disabled={pendingVote !== null}
          className={pendingVote === 'worked' ? 'vote-pending' : ''}
          onClick={() => onVote('worked')}
        >
          ✓ {positiveLabel} · {formatVoteCount(workedCount)}
        </button>
        <button
          type="button"
          className={`vote-negative ${pendingVote === 'didnt_work' ? 'vote-pending' : ''}`}
          disabled={pendingVote !== null}
          onClick={() => onVote('didnt_work')}
        >
          ✗ {negativeLabel} · {formatVoteCount(didntWorkCount)}
        </button>
      </div>
      <style>{`
        .vote-shell { display: grid; gap: 0.5rem; }
        .vote-ratio {
          height: 3px;
          border-radius: 999px;
          background: rgba(239, 68, 68, 0.18);
          overflow: hidden;
        }
        .vote-ratio-positive {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: rgba(16, 185, 129, 0.72);
        }
        .vote-buttons { display: flex; gap: 0.55rem; flex-wrap: wrap; }
        .vote-buttons button {
          border: 1px solid var(--color-border);
          border-radius: 999px;
          padding: 0.68rem 0.9rem;
          background: rgba(16, 185, 129, 0.12);
          color: var(--text-primary);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: transform 120ms ease, opacity 120ms ease;
        }
        .vote-buttons .vote-negative { background: rgba(239, 68, 68, 0.12); }
        .vote-buttons button:hover:not(:disabled) {
          transform: scale(1.02);
          opacity: 0.85;
        }
        .vote-buttons button:disabled {
          cursor: not-allowed;
          opacity: 0.72;
        }
        .vote-pending {
          animation: votePulse 0.9s ease-in-out infinite;
        }
        @keyframes votePulse {
          0%, 100% { opacity: 0.72; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

interface VoteButtonsProps {
  itemType: string;
  workedCount: number;
  didntWorkCount: number;
  pending?: boolean;
  onVote: (vote: 'worked' | 'didnt_work') => void;
}

export default function VoteButtons({
  itemType,
  workedCount,
  didntWorkCount,
  pending = false,
  onVote,
}: VoteButtonsProps) {
  const positiveLabel = itemType === 'platform_warning' ? 'Experiencing this' : 'Worked for me';
  const negativeLabel = itemType === 'platform_warning' ? 'Not affected' : "Didn't work";

  return (
    <div className="vote-buttons">
      <button type="button" disabled={pending} onClick={() => onVote('worked')}>
        {positiveLabel} · {workedCount}
      </button>
      <button type="button" className="vote-negative" disabled={pending} onClick={() => onVote('didnt_work')}>
        {negativeLabel} · {didntWorkCount}
      </button>
      <style>{`
        .vote-buttons { display:flex; gap:.55rem; flex-wrap:wrap; }
        .vote-buttons button {
          border:1px solid var(--color-border);
          border-radius:999px;
          padding:.62rem .85rem;
          background:rgba(16, 185, 129, 0.12);
          color:var(--text-primary);
          font:inherit;
          font-weight:700;
          cursor:pointer;
        }
        .vote-buttons .vote-negative { background:rgba(239, 68, 68, 0.12); }
      `}</style>
    </div>
  );
}

import { useState } from 'react';

interface ClaimModalProps {
  onCommit: (scAmount: number | null) => Promise<void>;
  onCancel: () => void;
}

export default function ClaimModal({
  onCommit,
  onCancel,
}: ClaimModalProps) {
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);

  async function commit(scAmount: number | null) {
    if (pending) {
      return;
    }

    setPending(true);
    try {
      await onCommit(scAmount);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="claim-modal">
      <label className="claim-field">
        <span>SC amount</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            if (value.trim().length === 0) {
              return;
            }
            void commit(Number(value));
          }}
          placeholder="245"
          disabled={pending}
        />
      </label>
      <div className="claim-actions">
        <button
          type="button"
          onClick={() => void commit(0)}
          disabled={pending}
        >
          {pending ? 'Saving...' : 'No SC today'}
        </button>
        <button type="button" className="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
      <style>{`
        .claim-modal {
          display: grid;
          gap: 0.85rem;
          padding: 1rem;
          border-radius: 1rem;
          background: rgba(37, 99, 235, 0.04);
          border: 1px solid rgba(37, 99, 235, 0.12);
        }

        .claim-field {
          display: grid;
          gap: 0.4rem;
          color: var(--color-muted);
          font-size: 0.95rem;
        }

        .claim-field input {
          border: 1px solid var(--color-border);
          border-radius: 0.9rem;
          padding: 0.8rem 0.9rem;
          font: inherit;
        }

        .claim-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .claim-actions button {
          border: none;
          border-radius: 999px;
          padding: 0.75rem 0.95rem;
          background: var(--color-primary);
          color: var(--text-primary);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .claim-actions .ghost {
          background: var(--color-surface);
          color: var(--color-ink);
          border: 1px solid var(--color-border);
        }
      `}</style>
    </div>
  );
}


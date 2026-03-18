import { useEffect, useState } from 'react';

interface LedgerModeToggleProps {
  initialMode: 'simple' | 'advanced';
  mode?: 'simple' | 'advanced';
  saveUrl?: string | null;
  onModeChange?: (mode: 'simple' | 'advanced') => void;
  onSaved?: (mode: 'simple' | 'advanced') => void | Promise<void>;
}

export default function LedgerModeToggle({
  initialMode,
  mode: controlledMode,
  saveUrl = '/api/v1/settings/ledger-mode',
  onModeChange,
  onSaved,
}: LedgerModeToggleProps) {
  const [internalMode, setInternalMode] = useState(initialMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInternalMode(initialMode);
  }, [initialMode]);

  const currentMode = controlledMode ?? internalMode;

  async function handleChange(nextMode: 'simple' | 'advanced') {
    const previousMode = currentMode;
    onModeChange?.(nextMode);
    setInternalMode(nextMode);
    setSaving(true);
    setError(null);

    try {
      if (saveUrl) {
        const response = await fetch(saveUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ledger_mode: nextMode }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? 'Unable to update ledger mode.');
        }
      }

      await onSaved?.(nextMode);
    } catch (saveError) {
      onModeChange?.(previousMode);
      setInternalMode(previousMode);
      setError(saveError instanceof Error ? saveError.message : 'Unable to update ledger mode.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mode-toggle">
      <div className="copy">
        <strong>Ledger Mode</strong>
        <span>Switching modes doesn&apos;t change your data - only what&apos;s displayed.</span>
      </div>
      <div className="options">
        {(['simple', 'advanced'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={currentMode === value ? 'active' : ''}
            disabled={saving}
            onClick={() => void handleChange(value)}
          >
            {value === 'simple' ? 'Simple' : 'Advanced'}
          </button>
        ))}
      </div>
      {error ? <p className="error-text">{error}</p> : null}

      <style>{`
        .mode-toggle {
          display: grid;
          gap: 0.75rem;
        }

        .copy {
          display: grid;
          gap: 0.2rem;
        }

        .copy span {
          color: var(--color-muted);
        }

        .options {
          display: flex;
          gap: 0.5rem;
        }

        .options button {
          border: 1px solid var(--color-border);
          border-radius: 999px;
          padding: 0.75rem 1rem;
          background: var(--color-surface);
          color: var(--color-ink);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .options .active {
          background: var(--color-primary);
          color: var(--text-primary);
          border-color: var(--color-primary);
        }

        .error-text {
          margin: 0;
          color: var(--color-danger);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}


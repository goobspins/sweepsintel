import { useState } from 'react';

interface QuickEditRowProps {
  casinoId: number;
  field: string;
  value: string | number | null;
  type?: 'text' | 'number';
  options?: string[];
  onSaved?: (next: string) => void;
}

export default function QuickEditRow({
  casinoId,
  field,
  value,
  type = 'text',
  options,
  onSaved,
}: QuickEditRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? '');
  const [pending, setPending] = useState(false);

  async function save(nextValue: string) {
    setPending(true);
    try {
      const response = await fetch('/api/admin/casinos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: casinoId,
          [field]: type === 'number' && nextValue !== '' ? Number(nextValue) : nextValue,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save field.');
      }
      onSaved?.(nextValue);
      setEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    if (options) {
      return (
        <select
          value={draft}
          disabled={pending}
          autoFocus
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraft(nextValue);
            void save(nextValue);
          }}
          onBlur={() => setEditing(false)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        autoFocus
        type={type}
        value={draft}
        disabled={pending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            void save(draft);
          }
          if (event.key === 'Escape') {
            setEditing(false);
            setDraft(value?.toString() ?? '');
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      style={{
        border: 'none',
        background: 'transparent',
        padding: 0,
        font: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {value ?? '--'}
    </button>
  );
}

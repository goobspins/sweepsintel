interface StateOption {
  state_code: string;
  state_name: string;
}

interface StateSubscriptionSelectorProps {
  states: StateOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export default function StateSubscriptionSelector({
  states,
  selected,
  onChange,
}: StateSubscriptionSelectorProps) {
  function toggle(stateCode: string) {
    const next = selected.includes(stateCode)
      ? selected.filter((code) => code !== stateCode)
      : [...selected, stateCode].sort();
    onChange(next);
  }

  return (
    <div className="subscription-selector">
      {states.map((state) => (
        <label key={state.state_code} className="subscription-option">
          <input
            type="checkbox"
            checked={selected.includes(state.state_code)}
            onChange={() => toggle(state.state_code)}
          />
          <span>{state.state_name}</span>
        </label>
      ))}

      <style>{`
        .subscription-selector {
          display:grid; gap:.65rem; max-height:16rem; overflow:auto; padding:.85rem;
          border:1px solid var(--color-border); border-radius:1rem; background:#fff;
        }
        .subscription-option {
          display:flex; gap:.6rem; align-items:center; color:var(--color-ink);
        }
      `}</style>
    </div>
  );
}

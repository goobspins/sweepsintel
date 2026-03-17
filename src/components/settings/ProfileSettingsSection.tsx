interface ProfileSettingsSectionProps {
  homeState: string;
  states: Array<{ state_code: string; state_name: string }>;
  onHomeStateChange: (value: string) => void;
}

export default function ProfileSettingsSection({
  homeState,
  states,
  onHomeStateChange,
}: ProfileSettingsSectionProps) {
  return (
    <section className="surface-card settings-section">
      <div className="eyebrow">Profile</div>
      <h2 className="section-title section-heading">Profile Settings</h2>
      <label className="field">
        <span>Home State</span>
        <select value={homeState} onChange={(event) => onHomeStateChange(event.target.value)}>
          <option value="">Select a state</option>
          {states.map((state) => (
            <option key={state.state_code} value={state.state_code}>{state.state_name}</option>
          ))}
        </select>
      </label>
      <style>{`
        .settings-section { display:grid; gap:1rem; padding:1.2rem; }
        .section-heading { margin:0; font-size:1.25rem; }
        .field { display:grid; gap:.45rem; }
        .field span { font-weight:700; }
        .field select {
          border:1px solid var(--color-border);
          border-radius:1rem;
          padding:.85rem .95rem;
          font:inherit;
          background:var(--color-surface);
          color:var(--text-primary);
        }
      `}</style>
    </section>
  );
}

interface GoalSettingsSectionProps {
  dailyGoalUsd: string;
  weeklyGoalUsd: string;
  onDailyGoalChange: (value: string) => void;
  onWeeklyGoalChange: (value: string) => void;
}

export default function GoalSettingsSection({
  dailyGoalUsd,
  weeklyGoalUsd,
  onDailyGoalChange,
  onWeeklyGoalChange,
}: GoalSettingsSectionProps) {
  return (
    <section className="surface-card settings-section">
      <div className="eyebrow">Goals</div>
      <h2 className="section-title section-heading">Goal Settings</h2>
      <div className="goal-grid">
        <label className="goal-field">
          <span>Daily SC Goal (USD)</span>
          <input type="number" min={0} step={0.5} value={dailyGoalUsd} onChange={(event) => onDailyGoalChange(event.target.value)} />
        </label>
        <label className="goal-field">
          <span>Weekly SC Goal (USD)</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={weeklyGoalUsd}
            onChange={(event) => onWeeklyGoalChange(event.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>
      <style>{`
        .settings-section { display:grid; gap:1rem; padding:1.2rem; }
        .section-heading { margin:0; font-size:1.25rem; }
        .goal-grid { display:grid; gap:.75rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .goal-field { display:grid; gap:.4rem; }
        .goal-field span { font-weight:700; color:var(--text-secondary); }
        .goal-field input {
          border:1px solid var(--color-border);
          border-radius:1rem;
          padding:.85rem .95rem;
          font:inherit;
          background:var(--color-surface);
          color:var(--text-primary);
        }
        @media (max-width: 720px) { .goal-grid { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}

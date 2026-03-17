import StateSubscriptionSelector from '../forms/StateSubscriptionSelector';
import type { TrackedCasinoPreference } from './types';

interface TrackingPreferencesSectionProps {
  timezone: string;
  timezoneOptions: string[];
  states: Array<{ state_code: string; state_name: string }>;
  stateSubscriptions: string[];
  trackedCasinos: TrackedCasinoPreference[];
  savingCasinoId: number | null;
  onTimezoneChange: (value: string) => void;
  onStateSubscriptionsChange: (value: string[]) => void;
  onUpdateCasinoTracking: (casinoId: number, noDailyReward: boolean) => void | Promise<void>;
}

export default function TrackingPreferencesSection({
  timezone,
  timezoneOptions,
  states,
  stateSubscriptions,
  trackedCasinos,
  savingCasinoId,
  onTimezoneChange,
  onStateSubscriptionsChange,
  onUpdateCasinoTracking,
}: TrackingPreferencesSectionProps) {
  return (
    <section className="surface-card settings-section">
      <div className="eyebrow">Tracking</div>
      <h2 className="section-title section-heading">Tracking Preferences</h2>
      <label className="field">
        <span>Timezone</span>
        <select value={timezone} onChange={(event) => onTimezoneChange(event.target.value)}>
          {timezoneOptions.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>
      <div className="field">
        <span>State Subscriptions</span>
        <StateSubscriptionSelector states={states} selected={stateSubscriptions} onChange={onStateSubscriptionsChange} />
      </div>
      <div className="field">
        <span>Tracked Casinos</span>
        {trackedCasinos.length === 0 ? (
          <div className="muted">Add casinos to your tracker before changing per-casino reward behavior.</div>
        ) : (
          <div className="casino-settings-list">
            {trackedCasinos.map((casino) => (
              <label key={casino.casino_id} className="casino-setting-row">
                <div className="casino-setting-copy">
                  <a href={`/casinos/${casino.slug}`} className="casino-link">{casino.casino_name}</a>
                  <span className="muted">Use this when you track the casino for balances or redemptions only.</span>
                </div>
                <span className="toggle-copy">
                  <input
                    type="checkbox"
                    checked={casino.no_daily_reward}
                    disabled={savingCasinoId === casino.casino_id}
                    onChange={(event) => void onUpdateCasinoTracking(casino.casino_id, event.target.checked)}
                  />
                  <span>No daily reward</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <style>{`
        .settings-section { display:grid; gap:1rem; padding:1.2rem; }
        .section-heading { margin:0; font-size:1.25rem; }
        .field { display:grid; gap:.45rem; }
        .field > span { font-weight:700; }
        .field select {
          border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem;
          font:inherit; background:var(--color-surface); color:var(--text-primary);
        }
        .casino-settings-list { display:grid; gap:.75rem; }
        .casino-setting-row {
          display:flex; justify-content:space-between; gap:1rem; align-items:center; flex-wrap:wrap;
          border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem; background:var(--color-surface);
        }
        .casino-setting-copy { display:grid; gap:.25rem; }
        .casino-link { color:var(--color-ink); text-decoration:none; font-weight:700; }
        .toggle-copy { display:flex; gap:.5rem; align-items:center; font-weight:700; }
      `}</style>
    </section>
  );
}

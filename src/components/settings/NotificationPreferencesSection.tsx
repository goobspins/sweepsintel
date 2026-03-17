import type { NotificationPreferences } from './types';

interface NotificationPreferencesSectionProps {
  notificationPreferences: NotificationPreferences;
  pushOptIn: boolean;
  pushBusy: boolean;
  vapidPublicKey: string;
  onNotificationPreferencesChange: (value: NotificationPreferences) => void;
  onTogglePush: (value: boolean) => void | Promise<void>;
}

export default function NotificationPreferencesSection({
  notificationPreferences,
  pushOptIn,
  pushBusy,
  vapidPublicKey,
  onNotificationPreferencesChange,
  onTogglePush,
}: NotificationPreferencesSectionProps) {
  return (
    <section className="surface-card settings-section">
      <div className="eyebrow">Notifications</div>
      <h2 className="section-title section-heading">Notification Preferences</h2>
      <div className="notification-grid">
        <label className="toggle-copy">
          <input type="checkbox" checked={notificationPreferences.push_warnings} onChange={(event) => onNotificationPreferencesChange({ ...notificationPreferences, push_warnings: event.target.checked })} />
          <span>Push warnings</span>
        </label>
        <label className="toggle-copy">
          <input type="checkbox" checked={notificationPreferences.push_deals} onChange={(event) => onNotificationPreferencesChange({ ...notificationPreferences, push_deals: event.target.checked })} />
          <span>Push deals</span>
        </label>
        <label className="toggle-copy">
          <input type="checkbox" checked={notificationPreferences.push_free_sc} onChange={(event) => onNotificationPreferencesChange({ ...notificationPreferences, push_free_sc: event.target.checked })} />
          <span>Push free SC</span>
        </label>
        <label className="toggle-copy">
          <input type="checkbox" checked={notificationPreferences.push_streak_reminders} onChange={(event) => onNotificationPreferencesChange({ ...notificationPreferences, push_streak_reminders: event.target.checked })} />
          <span>Push streak reminders</span>
        </label>
      </div>
      <label className="field">
        <span>Email digest</span>
        <select
          value={notificationPreferences.email_digest_frequency}
          onChange={(event) =>
            onNotificationPreferencesChange({
              ...notificationPreferences,
              email_digest_frequency: event.target.value as NotificationPreferences['email_digest_frequency'],
            })}
        >
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>
      <label className="push-toggle">
        <input type="checkbox" checked={pushOptIn} disabled={pushBusy || !vapidPublicKey} onChange={(event) => void onTogglePush(event.target.checked)} />
        <span>{vapidPublicKey ? 'Push notifications' : 'Push notifications (not configured yet)'}</span>
      </label>
      <style>{`
        .settings-section { display:grid; gap:1rem; padding:1.2rem; }
        .section-heading { margin:0; font-size:1.25rem; }
        .field { display:grid; gap:.45rem; }
        .field span { font-weight:700; }
        .field select {
          border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem;
          font:inherit; background:var(--color-surface); color:var(--text-primary);
        }
        .notification-grid { display:grid; gap:.65rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .toggle-copy { display:flex; gap:.5rem; align-items:center; font-weight:700; }
        .push-toggle { display:flex; gap:.6rem; align-items:center; }
        @media (max-width: 720px) { .notification-grid { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}

import { useState } from 'react';
import { useEffect } from 'react';

import LedgerModeToggle from '../ledger/LedgerModeToggle';
import StateSubscriptionSelector from '../forms/StateSubscriptionSelector';
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentPushSubscription,
} from '../../lib/push-browser';

interface SettingsPanelProps {
  initialSettings: {
    timezone: string;
    home_state: string | null;
    ledger_mode: 'simple' | 'advanced';
    state_subscriptions: string[];
    states: Array<{ state_code: string; state_name: string }>;
    vapid_public_key: string;
    tracked_casinos: Array<{
      casino_id: number;
      casino_name: string;
      slug: string;
      no_daily_reward: boolean;
    }>;
  };
}

type ToastState = { tone: 'success' | 'error'; message: string } | null;

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

export default function SettingsPanel({ initialSettings }: SettingsPanelProps) {
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [homeState, setHomeState] = useState(initialSettings.home_state ?? '');
  const [ledgerMode, setLedgerMode] = useState<'simple' | 'advanced'>(initialSettings.ledger_mode);
  const [stateSubscriptions, setStateSubscriptions] = useState(initialSettings.state_subscriptions);
  const [pushOptIn, setPushOptIn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [trackedCasinos, setTrackedCasinos] = useState(initialSettings.tracked_casinos);
  const [savingCasinoId, setSavingCasinoId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPushState() {
      try {
        const subscription = await getCurrentPushSubscription();
        if (!cancelled) {
          setPushOptIn(Boolean(subscription));
        }
      } catch {
        if (!cancelled) {
          setPushOptIn(false);
        }
      }
    }

    void loadPushState();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveSettings() {
    setSaving(true);
    setToast(null);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone,
          home_state: homeState || null,
          ledger_mode: ledgerMode,
          state_subscriptions: stateSubscriptions,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save settings.');
      }
      setToast({ tone: 'success', message: 'Settings saved.' });
      setTimezone(data.timezone);
      setHomeState(data.home_state ?? '');
      setLedgerMode(data.ledger_mode);
      setStateSubscriptions(data.state_subscriptions ?? []);
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to save settings.' });
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  async function togglePush(nextValue: boolean) {
    setPushBusy(true);
    try {
      if (nextValue) {
        await enablePushNotifications(initialSettings.vapid_public_key);
        setPushOptIn(true);
        setToast({ tone: 'success', message: 'Push notifications enabled.' });
      } else {
        await disablePushNotifications();
        setPushOptIn(false);
        setToast({ tone: 'success', message: 'Push notifications disabled.' });
      }
    } catch (error) {
      console.error(error);
      setToast({
        tone: 'error',
        message: nextValue
          ? 'Unable to enable push notifications.'
          : 'Unable to disable push notifications.',
      });
    } finally {
      setPushBusy(false);
    }
  }

  async function updateCasinoTracking(casinoId: number, noDailyReward: boolean) {
    setSavingCasinoId(casinoId);
    try {
      const response = await fetch('/api/tracker/casino-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: casinoId,
          no_daily_reward: noDailyReward,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save casino settings.');
      }

      setTrackedCasinos((current) =>
        current.map((casino) =>
          casino.casino_id === casinoId
            ? { ...casino, no_daily_reward: data.no_daily_reward }
            : casino,
        ),
      );
      setToast({ tone: 'success', message: 'Casino tracking updated.' });
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to save casino settings.' });
    } finally {
      setSavingCasinoId(null);
    }
  }

  return (
    <section className="surface-card settings-panel">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}
      <h1 className="section-title">Settings</h1>

      <label className="field">
        <span>Timezone</span>
        <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {[...COMMON_TIMEZONES, ...Intl.supportedValuesOf('timeZone').filter((value) => !COMMON_TIMEZONES.includes(value)).slice(0, 50)].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Home State</span>
        <select value={homeState} onChange={(event) => setHomeState(event.target.value)}>
          <option value="">Select a state</option>
          {initialSettings.states.map((state) => (
            <option key={state.state_code} value={state.state_code}>{state.state_name}</option>
          ))}
        </select>
      </label>

      <div className="field">
        <LedgerModeToggle
          initialMode={initialSettings.ledger_mode}
          mode={ledgerMode}
          saveUrl={null}
          onModeChange={setLedgerMode}
        />
      </div>

      <div className="field">
        <span>State Subscriptions</span>
        <StateSubscriptionSelector
          states={initialSettings.states}
          selected={stateSubscriptions}
          onChange={setStateSubscriptions}
        />
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
                  <a href={`/casinos/${casino.slug}`} className="casino-link">
                    {casino.casino_name}
                  </a>
                  <span className="muted">Use this when you track the casino for balances or redemptions only.</span>
                </div>
                <span className="toggle-copy">
                  <input
                    type="checkbox"
                    checked={casino.no_daily_reward}
                    disabled={savingCasinoId === casino.casino_id}
                    onChange={(event) =>
                      void updateCasinoTracking(casino.casino_id, event.target.checked)
                    }
                  />
                  <span>No daily reward</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="push-toggle">
        <input
          type="checkbox"
          checked={pushOptIn}
          disabled={pushBusy || !initialSettings.vapid_public_key}
          onChange={(event) => void togglePush(event.target.checked)}
        />
        <span>
          {initialSettings.vapid_public_key
            ? 'Push notifications'
            : 'Push notifications (not configured yet)'}
        </span>
      </label>

      <div className="actions">
        <button type="button" onClick={() => void saveSettings()} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <button type="button" className="ghost-button" onClick={() => void logout()}>
          Log out
        </button>
      </div>

      <style>{`
        .settings-panel { display:grid; gap:1rem; padding:1.25rem; }
        .field { display:grid; gap:.45rem; }
        .field span { font-weight:700; }
        .field select {
          border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem;
          font:inherit; background:#fff;
        }
        .casino-settings-list { display:grid; gap:.75rem; }
        .casino-setting-row {
          display:flex; justify-content:space-between; gap:1rem; align-items:center; flex-wrap:wrap;
          border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem; background:#fff;
        }
        .casino-setting-copy { display:grid; gap:.25rem; }
        .casino-link { color:var(--color-ink); text-decoration:none; font-weight:700; }
        .toggle-copy { display:flex; gap:.5rem; align-items:center; font-weight:700; }
        .push-toggle { display:flex; gap:.6rem; align-items:center; }
        .actions { display:flex; gap:.75rem; flex-wrap:wrap; }
        .actions button {
          border:none; border-radius:999px; padding:.85rem 1rem; background:var(--color-primary);
          color:#fff; font:inherit; font-weight:700; cursor:pointer;
        }
        .ghost-button {
          background:#fff !important; color:var(--color-ink) !important; border:1px solid var(--color-border) !important;
        }
        .toast {
          position:sticky; top:1rem; z-index:20; justify-self:center; padding:.85rem 1rem;
          border-radius:999px; font-weight:700;
        }
        .toast-success { background:#ecfdf5; color:#065f46; }
        .toast-error { background:#fef2f2; color:#991b1b; }
      `}</style>
    </section>
  );
}

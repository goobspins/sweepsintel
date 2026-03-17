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
    daily_goal_usd?: number | null;
    weekly_goal_usd?: number | null;
    kpi_cards?: string[];
    momentum_style?: string | null;
    layout_swap?: boolean;
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

type NotificationPreferences = {
  push_warnings: boolean;
  push_deals: boolean;
  push_free_sc: boolean;
  push_streak_reminders: boolean;
  email_digest_frequency: 'none' | 'daily' | 'weekly';
};

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

const DEFAULT_KPI_CARDS = ['sc_earned', 'usd_earned', 'purchases', 'pending_redemptions'];

const KPI_OPTIONS = [
  { id: 'sc_earned', label: 'SC Earned Today' },
  { id: 'usd_earned', label: 'USD Earned Today' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'pending_redemptions', label: 'Pending Redemptions' },
  { id: 'best_performer', label: 'Best Performer' },
  { id: 'claim_streak', label: 'Claim Streak' },
  { id: 'daily_velocity', label: 'Daily Velocity' },
] as const;

const MOMENTUM_STYLE_OPTIONS = [
  { id: 'rainbow', label: 'Rainbow', swatch: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 28%, #ef4444 52%, #f59e0b 76%, #10b981 100%)' },
  { id: 'green', label: 'Green', swatch: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { id: 'blue', label: 'Blue', swatch: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
  { id: 'amber', label: 'Amber', swatch: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { id: 'purple', label: 'Purple', swatch: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
] as const;

function getTimezoneOptions() {
  if (typeof Intl.supportedValuesOf !== 'function') {
    return COMMON_TIMEZONES;
  }

  try {
    return [
      ...COMMON_TIMEZONES,
      ...Intl.supportedValuesOf('timeZone')
        .filter((value) => !COMMON_TIMEZONES.includes(value))
        .slice(0, 50),
    ];
  } catch {
    return COMMON_TIMEZONES;
  }
}

export default function SettingsPanel({ initialSettings }: SettingsPanelProps) {
  const timezoneOptions = getTimezoneOptions();
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [homeState, setHomeState] = useState(initialSettings.home_state ?? '');
  const [ledgerMode, setLedgerMode] = useState<'simple' | 'advanced'>(initialSettings.ledger_mode);
  const [dailyGoalUsd, setDailyGoalUsd] = useState(
    initialSettings.daily_goal_usd?.toString() ?? '5',
  );
  const [weeklyGoalUsd, setWeeklyGoalUsd] = useState(
    initialSettings.weekly_goal_usd?.toString() ?? '',
  );
  const [kpiCards, setKpiCards] = useState<string[]>(
    initialSettings.kpi_cards && initialSettings.kpi_cards.length >= 3
      ? initialSettings.kpi_cards.slice(0, 4)
      : DEFAULT_KPI_CARDS,
  );
  const [momentumStyle, setMomentumStyle] = useState(
    initialSettings.momentum_style ?? 'rainbow',
  );
  const [stateSubscriptions, setStateSubscriptions] = useState(initialSettings.state_subscriptions);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    push_warnings: true,
    push_deals: true,
    push_free_sc: true,
    push_streak_reminders: false,
    email_digest_frequency: 'none',
  });
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

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const [settingsResponse, prefsResponse] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/notifications/preferences'),
        ]);
        const data = await settingsResponse.json();
        const prefsData = await prefsResponse.json();
        if (!settingsResponse.ok || cancelled) {
          return;
        }

        setTimezone(data.timezone ?? 'America/New_York');
        setHomeState(data.home_state ?? '');
        setLedgerMode(data.ledger_mode === 'advanced' ? 'advanced' : 'simple');
        setDailyGoalUsd(
          typeof data.daily_goal_usd === 'number' ? String(data.daily_goal_usd) : '5',
        );
        setWeeklyGoalUsd(
          typeof data.weekly_goal_usd === 'number' ? String(data.weekly_goal_usd) : '',
        );
        setKpiCards(
          Array.isArray(data.kpi_cards) && data.kpi_cards.length >= 3
            ? data.kpi_cards.slice(0, 4)
            : DEFAULT_KPI_CARDS,
        );
        setMomentumStyle(typeof data.momentum_style === 'string' ? data.momentum_style : 'rainbow');
        setStateSubscriptions(Array.isArray(data.state_subscriptions) ? data.state_subscriptions : []);
        if (prefsResponse.ok) {
          setNotificationPreferences({
            push_warnings: Boolean(prefsData.push_warnings ?? true),
            push_deals: Boolean(prefsData.push_deals ?? true),
            push_free_sc: Boolean(prefsData.push_free_sc ?? true),
            push_streak_reminders: Boolean(prefsData.push_streak_reminders ?? false),
            email_digest_frequency: ['daily', 'weekly'].includes(prefsData.email_digest_frequency)
              ? prefsData.email_digest_frequency
              : 'none',
          });
        }
      } catch (error) {
        console.error(error);
      }
    }

    void loadSettings();
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
          daily_goal_usd: dailyGoalUsd === '' ? 5 : Number(dailyGoalUsd),
          weekly_goal_usd: weeklyGoalUsd === '' ? null : Number(weeklyGoalUsd),
          kpi_cards: kpiCards,
          momentum_style: momentumStyle,
          state_subscriptions: stateSubscriptions,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save settings.');
      }
      const prefsResponse = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationPreferences),
      });
      if (!prefsResponse.ok) {
        const prefsData = await prefsResponse.json();
        throw new Error(prefsData.error ?? 'Unable to save notification preferences.');
      }
      setToast({ tone: 'success', message: 'Settings saved.' });
      setTimezone(data.timezone);
      setHomeState(data.home_state ?? '');
      setLedgerMode(data.ledger_mode);
      setDailyGoalUsd(typeof data.daily_goal_usd === 'number' ? String(data.daily_goal_usd) : '5');
      setWeeklyGoalUsd(typeof data.weekly_goal_usd === 'number' ? String(data.weekly_goal_usd) : '');
      setKpiCards(
        Array.isArray(data.kpi_cards) && data.kpi_cards.length >= 3
          ? data.kpi_cards.slice(0, 4)
          : DEFAULT_KPI_CARDS,
      );
      setMomentumStyle(typeof data.momentum_style === 'string' ? data.momentum_style : 'rainbow');
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

  function toggleKpiCard(cardId: string) {
    setKpiCards((current) => {
      if (current.includes(cardId)) {
        if (current.length <= 3) {
          setToast({ tone: 'error', message: 'Choose at least 3 KPI cards.' });
          return current;
        }
        return current.filter((id) => id !== cardId);
      }
      if (current.length >= 4) {
        setToast({ tone: 'error', message: 'Choose up to 4 KPI cards.' });
        return current;
      }
      return [...current, cardId];
    });
  }

  return (
    <section className="surface-card settings-panel">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}
      <h1 className="section-title">Settings</h1>

      <label className="field">
        <span>Timezone</span>
        <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {timezoneOptions.map((value) => (
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
        <span>Goals</span>
        <div className="goal-grid">
          <label className="goal-field">
            <span>Daily SC Goal (USD)</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={dailyGoalUsd}
              onChange={(event) => setDailyGoalUsd(event.target.value)}
            />
          </label>
          <label className="goal-field">
            <span>Weekly SC Goal (USD)</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={weeklyGoalUsd}
              onChange={(event) => setWeeklyGoalUsd(event.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
      </div>

      <div className="field">
        <span>Dashboard KPI Cards</span>
        <div className="kpi-picker">
          {KPI_OPTIONS.map((option) => {
            const checked = kpiCards.includes(option.id);
            const disableUnchecked = !checked && kpiCards.length >= 4;
            return (
              <label key={option.id} className={`kpi-option ${checked ? 'kpi-option-active' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disableUnchecked}
                  onChange={() => toggleKpiCard(option.id)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        <span className="field-hint">Choose 3 to 4 cards. Dashboard order follows your selection order.</span>
      </div>

      <div className="field">
        <span>Momentum Bar Style</span>
        <div className="swatch-row">
          {MOMENTUM_STYLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`swatch-button ${momentumStyle === option.id ? 'swatch-button-active' : ''}`}
              style={{ background: option.swatch }}
              aria-label={option.label}
              title={option.label}
              onClick={() => setMomentumStyle(option.id)}
            >
              {momentumStyle === option.id ? '✓' : ''}
            </button>
          ))}
        </div>
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
        <span>Notification Preferences</span>
        <div className="notification-grid">
          <label className="toggle-copy">
            <input
              type="checkbox"
              checked={notificationPreferences.push_warnings}
              onChange={(event) =>
                setNotificationPreferences((current) => ({ ...current, push_warnings: event.target.checked }))
              }
            />
            <span>Push warnings</span>
          </label>
          <label className="toggle-copy">
            <input
              type="checkbox"
              checked={notificationPreferences.push_deals}
              onChange={(event) =>
                setNotificationPreferences((current) => ({ ...current, push_deals: event.target.checked }))
              }
            />
            <span>Push deals</span>
          </label>
          <label className="toggle-copy">
            <input
              type="checkbox"
              checked={notificationPreferences.push_free_sc}
              onChange={(event) =>
                setNotificationPreferences((current) => ({ ...current, push_free_sc: event.target.checked }))
              }
            />
            <span>Push free SC</span>
          </label>
          <label className="toggle-copy">
            <input
              type="checkbox"
              checked={notificationPreferences.push_streak_reminders}
              onChange={(event) =>
                setNotificationPreferences((current) => ({ ...current, push_streak_reminders: event.target.checked }))
              }
            />
            <span>Push streak reminders</span>
          </label>
        </div>
        <label className="goal-field">
          <span>Email digest</span>
          <select
            value={notificationPreferences.email_digest_frequency}
            onChange={(event) =>
              setNotificationPreferences((current) => ({
                ...current,
                email_digest_frequency: event.target.value as NotificationPreferences['email_digest_frequency'],
              }))
            }
          >
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
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
        .field-hint { color:var(--text-muted); font-size:.85rem; font-weight:600; }
        .field select {
          border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem;
          font:inherit; background:var(--color-surface);
        }
        .goal-grid { display:grid; gap:.75rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .goal-field { display:grid; gap:.4rem; }
        .goal-field span { font-weight:700; color:var(--text-secondary); }
        .goal-field input {
          border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem;
          font:inherit; background:var(--color-surface); color:var(--text-primary);
        }
        .kpi-picker { display:grid; gap:.65rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .kpi-option {
          display:flex; gap:.65rem; align-items:center; border:1px solid var(--color-border);
          border-radius:1rem; padding:.8rem .9rem; background:var(--color-surface); color:var(--text-secondary);
        }
        .kpi-option-active { color:var(--text-primary); border-color:rgba(59, 130, 246, 0.32); }
        .swatch-row { display:flex; gap:.65rem; flex-wrap:wrap; }
        .swatch-button {
          width:28px; height:28px; border-radius:999px; border:1px solid var(--color-border);
          color:#fff; font-weight:800; cursor:pointer; display:grid; place-items:center;
          box-shadow:0 0 0 0 transparent; transition:transform 120ms ease, box-shadow 120ms ease;
        }
        .swatch-button-active { transform:scale(1.06); box-shadow:0 0 0 2px rgba(255,255,255,.18); }
        .casino-settings-list { display:grid; gap:.75rem; }
        .notification-grid { display:grid; gap:.65rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .casino-setting-row {
          display:flex; justify-content:space-between; gap:1rem; align-items:center; flex-wrap:wrap;
          border:1px solid var(--color-border); border-radius:1rem; padding:.85rem .95rem; background:var(--color-surface);
        }
        .casino-setting-copy { display:grid; gap:.25rem; }
        .casino-link { color:var(--color-ink); text-decoration:none; font-weight:700; }
        .toggle-copy { display:flex; gap:.5rem; align-items:center; font-weight:700; }
        .push-toggle { display:flex; gap:.6rem; align-items:center; }
        .actions { display:flex; gap:.75rem; flex-wrap:wrap; }
        .actions button {
          border:none; border-radius:999px; padding:.85rem 1rem; background:var(--color-primary);
          color:var(--text-primary); font:inherit; font-weight:700; cursor:pointer;
        }
        .ghost-button {
          background:var(--color-surface) !important; color:var(--color-ink) !important; border:1px solid var(--color-border) !important;
        }
        .toast {
          position:sticky; top:1rem; z-index:20; justify-self:center; padding:.85rem 1rem;
          border-radius:999px; font-weight:700;
        }
        .toast-success { background:rgba(16, 185, 129, 0.16); color:var(--accent-green); }
        .toast-error { background:rgba(239, 68, 68, 0.16); color:var(--accent-red); }
        @media (max-width: 720px) { .goal-grid, .kpi-picker, .notification-grid { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}


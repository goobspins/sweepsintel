import { useEffect, useState } from 'react';

import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentPushSubscription,
} from '../../lib/push-browser';
import DashboardPreferencesSection from './DashboardPreferencesSection';
import DangerZoneSection from './DangerZoneSection';
import GoalSettingsSection from './GoalSettingsSection';
import NotificationPreferencesSection from './NotificationPreferencesSection';
import ProfileSettingsSection from './ProfileSettingsSection';
import TrackingPreferencesSection from './TrackingPreferencesSection';
import {
  DEFAULT_KPI_CARDS,
  getTimezoneOptions,
  type NotificationPreferences,
  type SettingsPanelProps,
  type ToastState,
} from './types';

export default function SettingsPanel({ initialSettings }: SettingsPanelProps) {
  const timezoneOptions = getTimezoneOptions();
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [homeState, setHomeState] = useState(initialSettings.home_state ?? '');
  const [ledgerMode, setLedgerMode] = useState<'simple' | 'advanced'>(initialSettings.ledger_mode);
  const [dailyGoalUsd, setDailyGoalUsd] = useState(initialSettings.daily_goal_usd?.toString() ?? '5');
  const [weeklyGoalUsd, setWeeklyGoalUsd] = useState(initialSettings.weekly_goal_usd?.toString() ?? '');
  const [kpiCards, setKpiCards] = useState<string[]>(
    initialSettings.kpi_cards && initialSettings.kpi_cards.length >= 3 ? initialSettings.kpi_cards.slice(0, 4) : DEFAULT_KPI_CARDS,
  );
  const [momentumStyle, setMomentumStyle] = useState(initialSettings.momentum_style ?? 'rainbow');
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
        if (!cancelled) setPushOptIn(Boolean(subscription));
      } catch {
        if (!cancelled) setPushOptIn(false);
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
        if (!settingsResponse.ok || cancelled) return;
        setTimezone(data.timezone ?? 'America/New_York');
        setHomeState(data.home_state ?? '');
        setLedgerMode(data.ledger_mode === 'advanced' ? 'advanced' : 'simple');
        setDailyGoalUsd(typeof data.daily_goal_usd === 'number' ? String(data.daily_goal_usd) : '5');
        setWeeklyGoalUsd(typeof data.weekly_goal_usd === 'number' ? String(data.weekly_goal_usd) : '');
        setKpiCards(Array.isArray(data.kpi_cards) && data.kpi_cards.length >= 3 ? data.kpi_cards.slice(0, 4) : DEFAULT_KPI_CARDS);
        setMomentumStyle(typeof data.momentum_style === 'string' ? data.momentum_style : 'rainbow');
        setStateSubscriptions(Array.isArray(data.state_subscriptions) ? data.state_subscriptions : []);
        if (prefsResponse.ok) {
          setNotificationPreferences({
            push_warnings: Boolean(prefsData.push_warnings ?? true),
            push_deals: Boolean(prefsData.push_deals ?? true),
            push_free_sc: Boolean(prefsData.push_free_sc ?? true),
            push_streak_reminders: Boolean(prefsData.push_streak_reminders ?? false),
            email_digest_frequency: ['daily', 'weekly'].includes(prefsData.email_digest_frequency) ? prefsData.email_digest_frequency : 'none',
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
      if (!response.ok) throw new Error(data.error ?? 'Unable to save settings.');
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
      setKpiCards(Array.isArray(data.kpi_cards) && data.kpi_cards.length >= 3 ? data.kpi_cards.slice(0, 4) : DEFAULT_KPI_CARDS);
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
      setToast({ tone: 'error', message: nextValue ? 'Unable to enable push notifications.' : 'Unable to disable push notifications.' });
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
        body: JSON.stringify({ casino_id: casinoId, no_daily_reward: noDailyReward }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save casino settings.');
      setTrackedCasinos((current) => current.map((casino) => (casino.casino_id === casinoId ? { ...casino, no_daily_reward: data.no_daily_reward } : casino)));
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
    <section className="settings-panel">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}
      <section className="surface-card settings-hero">
        <div className="eyebrow">Settings</div>
        <h1 className="section-title">Settings</h1>
      </section>
      <ProfileSettingsSection homeState={homeState} states={initialSettings.states} onHomeStateChange={setHomeState} />
      <GoalSettingsSection dailyGoalUsd={dailyGoalUsd} weeklyGoalUsd={weeklyGoalUsd} onDailyGoalChange={setDailyGoalUsd} onWeeklyGoalChange={setWeeklyGoalUsd} />
      <DashboardPreferencesSection
        initialLedgerMode={initialSettings.ledger_mode}
        ledgerMode={ledgerMode}
        onLedgerModeChange={setLedgerMode}
        kpiCards={kpiCards}
        momentumStyle={momentumStyle}
        onToggleKpiCard={toggleKpiCard}
        onMomentumStyleChange={setMomentumStyle}
      />
      <TrackingPreferencesSection
        timezone={timezone}
        timezoneOptions={timezoneOptions}
        states={initialSettings.states}
        stateSubscriptions={stateSubscriptions}
        trackedCasinos={trackedCasinos}
        savingCasinoId={savingCasinoId}
        onTimezoneChange={setTimezone}
        onStateSubscriptionsChange={setStateSubscriptions}
        onUpdateCasinoTracking={updateCasinoTracking}
      />
      <NotificationPreferencesSection
        notificationPreferences={notificationPreferences}
        pushOptIn={pushOptIn}
        pushBusy={pushBusy}
        vapidPublicKey={initialSettings.vapid_public_key}
        onNotificationPreferencesChange={setNotificationPreferences}
        onTogglePush={togglePush}
      />
      <section className="surface-card action-card">
        <div className="actions">
          <button type="button" onClick={() => void saveSettings()} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </section>
      <DangerZoneSection onLogout={logout} />
      <style>{`
        .settings-panel { display:grid; gap:1rem; }
        .settings-hero, .action-card { padding:1.2rem; }
        .settings-hero h1 { margin:0; }
        .actions { display:flex; gap:.75rem; flex-wrap:wrap; }
        .actions button {
          border:none; border-radius:999px; padding:.85rem 1rem; background:var(--color-primary);
          color:var(--text-primary); font:inherit; font-weight:700; cursor:pointer;
        }
        .toast {
          position:sticky; top:1rem; z-index:20; justify-self:center; padding:.85rem 1rem;
          border-radius:999px; font-weight:700;
        }
        .toast-success { background:rgba(16, 185, 129, 0.16); color:var(--accent-green); }
        .toast-error { background:rgba(239, 68, 68, 0.16); color:var(--accent-red); }
      `}</style>
    </section>
  );
}

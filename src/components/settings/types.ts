export interface SettingsPanelProps {
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
    tracked_casinos: TrackedCasinoPreference[];
  };
}

export type TrackedCasinoPreference = {
  casino_id: number;
  casino_name: string;
  slug: string;
  no_daily_reward: boolean;
};

export type NotificationPreferences = {
  push_warnings: boolean;
  push_deals: boolean;
  push_free_sc: boolean;
  push_streak_reminders: boolean;
  email_digest_frequency: 'none' | 'daily' | 'weekly';
};

export type ToastState = { tone: 'success' | 'error'; message: string } | null;

export const DEFAULT_KPI_CARDS = ['sc_earned', 'usd_earned', 'purchases', 'pending_redemptions'];

export const KPI_OPTIONS = [
  { id: 'sc_earned', label: 'SC Earned Today' },
  { id: 'usd_earned', label: 'USD Earned Today' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'pending_redemptions', label: 'Pending Redemptions' },
  { id: 'best_performer', label: 'Best Performer' },
  { id: 'claim_streak', label: 'Claim Streak' },
  { id: 'daily_velocity', label: 'Daily Velocity' },
] as const;

export const MOMENTUM_STYLE_OPTIONS = [
  { id: 'rainbow', label: 'Rainbow', swatch: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 28%, #ef4444 52%, #f59e0b 76%, #10b981 100%)' },
  { id: 'green', label: 'Green', swatch: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { id: 'blue', label: 'Blue', swatch: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
  { id: 'amber', label: 'Amber', swatch: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { id: 'purple', label: 'Purple', swatch: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
] as const;

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

export function getTimezoneOptions() {
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

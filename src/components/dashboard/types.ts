import type { SessionUser } from '../../lib/auth';
import type { TrackerStatusData } from '../../lib/tracker';

export type ToastState =
  | {
      tone: 'success' | 'error';
      message: string;
    }
  | null;

export type DashboardSummary = {
  dailyGoalUsd: number;
  weeklyGoalUsd: number | null;
  momentumPeriod: 'daily' | 'weekly';
  momentumStyle: string;
  scEarnedToday: number;
  usdEarnedToday: number;
  scEarnedWeek: number;
  usdEarnedWeek: number;
  purchaseCountToday: number;
  purchaseUsdToday: number;
  pendingRedemptionsCount: number;
  pendingRedemptionsUsd: number;
};

export type DashboardDiscoveryCasino = {
  id: number;
  slug: string;
  name: string;
  tier: string | null;
  promoban_risk: string | null;
  daily_bonus_desc: string | null;
  redemption_speed_desc: string | null;
  has_live_games: boolean;
  has_affiliate_link: boolean;
  affiliate_link_url: string | null;
  intel_count: number;
  tracker_count: number;
  estimated_daily_usd?: number;
};

export type DashboardDiscovery = {
  homeState: string | null;
  casinos: DashboardDiscoveryCasino[];
  estimatedDailyUsd?: number;
  stateRequired?: boolean;
  latestSignal?: {
    id: number;
    title: string;
    item_type: string;
    created_at: string;
    casino_name: string | null;
  } | null;
};

export type DashboardSearchResult = {
  id: number;
  name: string;
  slug: string;
  tier: string | null;
  source?: string;
};

export type DashboardTrackerProps = {
  user: SessionUser;
  initialData: TrackerStatusData;
  initialSummary: DashboardSummary;
  initialDiscovery: DashboardDiscovery;
};

export type ActionMode = 'daily' | 'adjust' | 'spins';
export type CasinoStatus = 'available' | 'countdown' | 'claimed' | 'no-daily';

export type CasinoRowModel = {
  casinoId: number;
  name: string;
  slug: string;
  tier: string | null;
  sortOrder: number | null;
  resetMode: string | null;
  resetTimeLocal: string | null;
  resetTimezone: string | null;
  resetIntervalHours: number;
  noDailyReward: boolean;
  lastClaimedAt: string | null;
  scToUsdRatio: number;
  healthStatus: string | null;
  promobanRisk: string | null;
  redemptionSpeedDesc: string | null;
  dailyBonusDesc: string | null;
  status: CasinoStatus;
};

export type PurchaseDraft = {
  costUsd: string;
  scAmount: string;
  promoCode: string;
  notes: string;
};


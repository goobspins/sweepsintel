export type KpiCardId =
  | 'sc_earned'
  | 'usd_earned'
  | 'purchases'
  | 'pending_redemptions'
  | 'best_performer'
  | 'claim_streak'
  | 'daily_velocity';

export type ReportsSummary = {
  kpiCards: KpiCardId[];
  scEarnedToday: number;
  usdEarnedToday: number;
  purchaseCountToday: number;
  purchaseUsdToday: number;
  pendingRedemptionsCount: number;
  pendingRedemptionsUsd: number;
  bestPerformerName: string | null;
  bestPerformerSc: number;
  claimStreakDays: number;
  dailyVelocityPct: number;
  totalSc: number;
  totalInvestedUsd: number;
  totalRedeemedUsd: number;
  netPlUsd: number;
};

export type ReportCasinoRow = {
  casinoId: number;
  name: string;
  slug: string;
  tier: string | null;
  scBalance: number;
  usdInvested: number;
  usdRedeemed: number;
  netPlUsd: number;
  lastActivityAt: string | null;
};

export type RecentActivityRow = {
  id: number;
  casinoName: string;
  casinoSlug: string;
  entryType: string;
  scAmount: number | null;
  usdAmount: number | null;
  notes: string | null;
  entryAt: string | null;
};

export type SortKey = 'name' | 'scBalance' | 'usdInvested' | 'usdRedeemed' | 'netPlUsd' | 'lastActivityAt';

export const DEFAULT_KPI_CARDS: KpiCardId[] = ['sc_earned', 'usd_earned', 'purchases', 'pending_redemptions'];

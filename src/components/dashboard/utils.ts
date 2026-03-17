import { DateTime } from 'luxon';

import { computeFixedResetPeriodStart } from '../../lib/reset';
import type { TrackerCasinoRow } from '../../lib/tracker';
import type {
  ActionMode,
  CasinoRowModel,
  CasinoStatus,
  DashboardDiscoveryCasino,
  PurchaseDraft,
} from './types';

export const DEFAULT_PURCHASE_DRAFT: PurchaseDraft = {
  costUsd: '',
  scAmount: '',
  promoCode: '',
  notes: '',
};

export const MOMENTUM_GRADIENTS: Record<string, string> = {
  rainbow: 'var(--progress-gradient)',
  green: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  blue: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  amber: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  purple: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
};

export const MODE_META: Record<ActionMode, { label: string; saveLabel: string; accent: string; endpoint: string }> = {
  daily: { label: 'Daily', saveLabel: 'Save', accent: 'var(--accent-green)', endpoint: '/api/tracker/claim' },
  adjust: { label: 'Adjust', saveLabel: 'Save Adj', accent: 'var(--accent-yellow)', endpoint: '/api/ledger/entry' },
  spins: { label: 'Free Spins', saveLabel: 'Save Free Spins', accent: 'var(--accent-blue)', endpoint: '/api/tracker/free-sc' },
};

export function normalizeCasinoName(name: string) {
  return name
    .toLowerCase()
    .replace(/\.com|\.net/g, '')
    .replace(/casino|sweeps|sweepstakes/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function buildCasinoRowModel(casino: TrackerCasinoRow, claims: string[], nowTs: number): CasinoRowModel {
  const lastClaimedAt = claims[0] ?? casino.today_claimed_at ?? null;
  const status = getCasinoStatus(casino, lastClaimedAt, nowTs);
  return {
    casinoId: casino.casino_id,
    name: casino.name,
    slug: casino.slug,
    tier: casino.tier,
    sortOrder: casino.sort_order,
    resetMode: casino.reset_mode,
    resetTimeLocal: casino.reset_time_local,
    resetTimezone: casino.reset_timezone,
    resetIntervalHours: casino.reset_interval_hours ?? 24,
    noDailyReward: casino.no_daily_reward,
    lastClaimedAt,
    scToUsdRatio: toNumber(casino.sc_to_usd_ratio, 1),
    healthStatus: casino.health_status ?? 'healthy',
    promobanRisk: casino.promoban_risk,
    redemptionSpeedDesc: casino.redemption_speed_desc,
    dailyBonusDesc: casino.daily_bonus_desc,
    status,
  };
}

function getCasinoStatus(casino: TrackerCasinoRow, lastClaimedAt: string | null, nowTs: number): CasinoStatus {
  if (casino.no_daily_reward) {
    return 'no-daily';
  }

  if (!lastClaimedAt) {
    return 'available';
  }

  if (casino.reset_mode === 'fixed') {
    const currentPeriodStart = computeFixedResetPeriodStart(
      {
        reset_time_local: casino.reset_time_local,
        reset_timezone: casino.reset_timezone,
        reset_interval_hours: casino.reset_interval_hours ?? 24,
      },
      DateTime.fromMillis(nowTs),
    );

    if (!currentPeriodStart) {
      return 'available';
    }

    const lastClaim = DateTime.fromISO(lastClaimedAt).toUTC();
    if (!lastClaim.isValid) {
      return 'available';
    }

    return lastClaim >= currentPeriodStart.toUTC() ? 'claimed' : 'available';
  }

  const nextResetAt = getNextResetAt(
    {
      resetMode: casino.reset_mode,
      resetTimeLocal: casino.reset_time_local,
      resetTimezone: casino.reset_timezone,
      resetIntervalHours: casino.reset_interval_hours ?? 24,
      lastClaimedAt,
    },
    nowTs,
  );

  if (!nextResetAt) {
    return 'available';
  }

  return nextResetAt <= DateTime.fromMillis(nowTs).toUTC() ? 'available' : 'claimed';
}

export function statusRank(status: CasinoStatus) {
  if (status === 'available') return 0;
  if (status === 'countdown') return 1;
  if (status === 'claimed') return 2;
  return 3;
}

export function nextResetSortValue(casino: CasinoRowModel, userTimezone: string) {
  if (casino.status === 'no-daily' || casino.status === 'claimed') return Number.MAX_SAFE_INTEGER;
  if (casino.status === 'available') return 0;
  const nextResetAt = getNextResetAt(casino, Date.now());
  if (nextResetAt) {
    return nextResetAt.setZone(userTimezone).toMillis();
  }
  return 0;
}

function getNextResetAt(
  casino: Pick<CasinoRowModel, 'resetMode' | 'resetTimeLocal' | 'resetTimezone' | 'resetIntervalHours' | 'lastClaimedAt'>,
  nowTs: number,
) {
  const now = DateTime.fromMillis(nowTs);

  if (casino.resetMode === 'fixed') {
    const currentPeriodStart = computeFixedResetPeriodStart(
      {
        reset_time_local: casino.resetTimeLocal,
        reset_timezone: casino.resetTimezone,
        reset_interval_hours: casino.resetIntervalHours,
      },
      now,
    );

    if (!currentPeriodStart) {
      return null;
    }

    return currentPeriodStart.plus({ hours: casino.resetIntervalHours || 24 }).toUTC();
  }

  if (!casino.lastClaimedAt) {
    return null;
  }

  const lastClaim = DateTime.fromISO(casino.lastClaimedAt);
  if (!lastClaim.isValid) {
    return null;
  }

  return lastClaim.plus({ hours: casino.resetIntervalHours || 24 }).toUTC();
}

export function getCasinoStatusDisplay(casino: CasinoRowModel, userTimezone: string, nowTs: number) {
  const nextResetAt = getNextResetAt(casino, nowTs);
  const lastClaimLabel = casino.lastClaimedAt ? formatLastClaim(casino.lastClaimedAt, userTimezone) : null;

  if (casino.status === 'available') {
    return {
      isDue: true,
      primary: 'Available now',
      primaryClassName: 'status-available',
      secondary: nextResetAt ? `Resets in ${formatCountdownFrom(nextResetAt, nowTs, userTimezone)}` : null,
      secondaryClassName: 'status-secondary-amber',
    };
  }

  if (casino.status === 'claimed') {
    return {
      isDue: false,
      primary: nextResetAt ? `Next in ${formatCountdownFrom(nextResetAt, nowTs, userTimezone)}` : 'Next reset unavailable',
      primaryClassName: 'status-claimed',
      secondary: lastClaimLabel ? `Last ${lastClaimLabel}` : null,
      secondaryClassName: 'status-secondary',
    };
  }

  if (casino.status === 'countdown') {
    return {
      isDue: false,
      primary: nextResetAt ? `Available in ${formatCountdownFrom(nextResetAt, nowTs, userTimezone)}` : 'Ready to claim',
      primaryClassName: 'status-countdown',
      secondary: null,
      secondaryClassName: 'status-secondary',
    };
  }

  return {
    isDue: false,
    primary: 'No daily reward',
    primaryClassName: 'status-countdown',
    secondary: null,
    secondaryClassName: 'status-secondary',
  };
}

export function getTierBadgeStyle(tier: string) {
  if (tier === 'S') return { background: 'rgba(245, 158, 11, 0.16)', color: 'var(--accent-yellow)', borderColor: 'rgba(245, 158, 11, 0.32)' };
  if (tier === 'A') return { background: 'rgba(16, 185, 129, 0.16)', color: 'var(--accent-green)', borderColor: 'rgba(16, 185, 129, 0.32)' };
  if (tier === 'B') return { background: 'rgba(59, 130, 246, 0.16)', color: 'var(--accent-blue)', borderColor: 'rgba(59, 130, 246, 0.32)' };
  return { background: 'rgba(156, 163, 175, 0.12)', color: 'var(--text-secondary)', borderColor: 'rgba(156, 163, 175, 0.26)' };
}

export function getDiscoveryHealthStyle(risk: string | null) {
  if (risk === 'none' || risk === 'low') {
    return { color: 'var(--accent-green)', background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.24)' };
  }
  if (risk === 'medium') {
    return { color: 'var(--accent-yellow)', background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.24)' };
  }
  if (risk === 'high') {
    return { color: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.24)' };
  }
  return { color: 'var(--text-muted)', background: 'rgba(156, 163, 175, 0.12)', borderColor: 'rgba(156, 163, 175, 0.24)' };
}

export function getDiscoveryHealthLabel(risk: string | null) {
  if (risk === 'none' || risk === 'low') return 'Low PB Risk';
  if (risk === 'medium') return 'Moderate PB Risk';
  if (risk === 'high') return 'High PB Risk';
  return null;
}

export function hasDiscoveryAffiliateLink(casino: DashboardDiscoveryCasino) {
  return Boolean(casino.has_affiliate_link && casino.affiliate_link_url);
}

export function getDiscoveryCardAccentStyle(tier: string | null) {
  if (tier === 'S') return { borderLeft: '3px solid var(--accent-yellow)' };
  if (tier === 'A') return { borderLeft: '3px solid var(--accent-green)' };
  if (tier === 'B') return { borderLeft: '3px solid var(--accent-blue)' };
  return { borderLeft: '3px solid var(--color-border)' };
}

function hasMeaningfulValue(value: string | null) {
  return Boolean(value && value.trim());
}

function formatDiscoverySignal(casino: DashboardDiscoveryCasino) {
  if (casino.intel_count > 0) {
    return `${casino.intel_count} live intel item${casino.intel_count === 1 ? '' : 's'}`;
  }
  if (casino.tracker_count > 0) {
    return `${casino.tracker_count} tracker${casino.tracker_count === 1 ? '' : 's'} watching`;
  }
  return 'New on SweepsIntel';
}

export function buildSpotlightFacts(casino: DashboardDiscoveryCasino) {
  const facts: Array<{ label: string; value: string }> = [];

  if (hasMeaningfulValue(casino.daily_bonus_desc)) {
    facts.push({ label: 'Daily bonus', value: casino.daily_bonus_desc!.trim() });
  }
  if (hasMeaningfulValue(casino.redemption_speed_desc)) {
    facts.push({ label: 'Redeem speed', value: casino.redemption_speed_desc!.trim() });
  }
  if (getDiscoveryHealthLabel(casino.promoban_risk)) {
    facts.push({ label: 'PB risk', value: getDiscoveryHealthLabel(casino.promoban_risk)! });
  }
  facts.push({ label: 'Signal', value: formatDiscoverySignal(casino) });
  return facts;
}

export function buildDiscoveryPitch(casino: DashboardDiscoveryCasino) {
  const fragments = [];
  if (hasMeaningfulValue(casino.daily_bonus_desc)) {
    fragments.push(`${casino.daily_bonus_desc!.trim()}.`);
  }
  if (hasMeaningfulValue(casino.redemption_speed_desc)) {
    fragments.push(`Redemptions: ${casino.redemption_speed_desc!.trim()}.`);
  }
  if (fragments.length === 0) {
    return 'This casino is tracked by SweepsIntel. Visit the full profile for details.';
  }
  if (casino.has_live_games) {
    fragments.push('Live tables are available, so keep your account setup disciplined.');
  }
  return fragments.join(' ');
}

export function buildCompactPitch(casino: DashboardDiscoveryCasino) {
  if (hasMeaningfulValue(casino.daily_bonus_desc)) {
    return casino.daily_bonus_desc!.trim();
  }
  if (hasMeaningfulValue(casino.redemption_speed_desc)) {
    return `Redeems in ${casino.redemption_speed_desc!.trim()}`;
  }
  if (casino.has_live_games) {
    return 'Live dealer games available';
  }
  return null;
}

export function getDiscoveryLead(casino: DashboardDiscoveryCasino) {
  if (hasMeaningfulValue(casino.redemption_speed_desc)) return casino.redemption_speed_desc!.trim();
  if (hasMeaningfulValue(casino.daily_bonus_desc)) return casino.daily_bonus_desc!.trim();
  if (casino.intel_count > 0) return `${casino.intel_count} intel note${casino.intel_count === 1 ? '' : 's'}`;
  if (casino.tracker_count > 0) return `${casino.tracker_count} tracker${casino.tracker_count === 1 ? '' : 's'}`;
  return 'New on SweepsIntel';
}

function formatLastClaim(value: string, timezone: string) {
  const dt = DateTime.fromISO(value).setZone(timezone);
  return dt.isValid ? dt.toFormat('MMM d, h:mm a') : null;
}

function formatCountdownFrom(nextResetAt: DateTime, nowTs: number, userTimezone: string) {
  const next = nextResetAt.setZone(userTimezone);
  if (!next.isValid) {
    return 'unknown';
  }

  const minutes = Math.max(0, Math.floor(next.diff(DateTime.fromMillis(nowTs).setZone(userTimezone), 'minutes').minutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}


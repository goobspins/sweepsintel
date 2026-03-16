import { useEffect, useMemo, useRef, useState } from 'react';
import { DateTime } from 'luxon';

import type { SessionUser } from '../../lib/auth';
import { computeFixedResetPeriodStart } from '../../lib/reset';
import type { TrackerCasinoRow, TrackerStatusData } from '../../lib/tracker';

type ToastState =
  | {
      tone: 'success' | 'error';
      message: string;
    }
  | null;

type DashboardSummary = {
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

type DashboardDiscoveryCasino = {
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
};

type DashboardDiscovery = {
  homeState: string | null;
  casinos: DashboardDiscoveryCasino[];
};

type DashboardSearchResult = {
  id: number;
  name: string;
  slug: string;
  tier: string | null;
  source?: string;
};

type DashboardTrackerProps = {
  user: SessionUser;
  initialData: TrackerStatusData;
  initialSummary: DashboardSummary;
  initialDiscovery: DashboardDiscovery;
};

type ActionMode = 'daily' | 'adjust' | 'spins';
type CasinoStatus = 'available' | 'countdown' | 'claimed' | 'no-daily';

type CasinoRowModel = {
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
  status: CasinoStatus;
};

type PurchaseDraft = {
  costUsd: string;
  scAmount: string;
  promoCode: string;
  notes: string;
};

const DEFAULT_PURCHASE_DRAFT: PurchaseDraft = {
  costUsd: '',
  scAmount: '',
  promoCode: '',
  notes: '',
};

const MOMENTUM_GRADIENTS: Record<string, string> = {
  rainbow: 'var(--progress-gradient)',
  green: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  blue: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  amber: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  purple: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
};

const MODE_META: Record<ActionMode, { label: string; saveLabel: string; accent: string; endpoint: string }> = {
  daily: { label: 'Daily', saveLabel: 'Save', accent: 'var(--accent-green)', endpoint: '/api/tracker/claim' },
  adjust: { label: 'Adjust', saveLabel: 'Save Adj', accent: 'var(--accent-yellow)', endpoint: '/api/ledger/entry' },
  spins: { label: 'Free Spins', saveLabel: 'Save Free Spins', accent: 'var(--accent-blue)', endpoint: '/api/tracker/free-sc' },
};

async function readApiResponse(response: Response) {
  const contentType = response.headers.get('Content-Type') ?? '';
  const rawText = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return rawText ? JSON.parse(rawText) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export default function DashboardTracker({ user, initialData, initialSummary, initialDiscovery }: DashboardTrackerProps) {
  const [casinos, setCasinos] = useState(initialData.casinos);
  const [streakClaims, setStreakClaims] = useState(initialData.streakClaims);
  const [summary, setSummary] = useState(initialSummary);
  const [discovery] = useState(initialDiscovery);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [toast, setToast] = useState<ToastState>(null);
  const [modeByCasino, setModeByCasino] = useState<Record<number, ActionMode>>({});
  const [amountByCasino, setAmountByCasino] = useState<Record<number, string>>({});
  const [noteByCasino, setNoteByCasino] = useState<Record<number, string>>({});
  const [inputErrorByCasino, setInputErrorByCasino] = useState<Record<number, string>>({});
  const [purchaseOpenByCasino, setPurchaseOpenByCasino] = useState<Record<number, boolean>>({});
  const [purchaseDraftByCasino, setPurchaseDraftByCasino] = useState<Record<number, PurchaseDraft>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [momentumCollapsed, setMomentumCollapsed] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(initialData.casinos.length > 0);
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState(() => initialSummary.dailyGoalUsd.toFixed(2));
  const [goalSaving, setGoalSaving] = useState(false);
  const goalCancelRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DashboardSearchResult[]>([]);
  const [nearMatch, setNearMatch] = useState<DashboardSearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [momentumPeriod, setMomentumPeriod] = useState<'daily' | 'weekly'>(() => initialSummary.momentumPeriod ?? 'daily');
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialData.casinos.length === 0) {
      setBootstrapping(false);
      return;
    }

    void refreshTracker()
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        setBootstrapping(false);
      });
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem('si-momentum-collapsed');
    if (saved === 'true') setMomentumCollapsed(true);
    if (saved === 'false') setMomentumCollapsed(false);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('si-momentum-collapsed', momentumCollapsed ? 'true' : 'false');
  }, [momentumCollapsed]);

  useEffect(() => {
    const saved = window.localStorage.getItem('si-momentum-period');
    if (saved === 'daily' || saved === 'weekly') {
      setMomentumPeriod(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('si-momentum-period', momentumPeriod);
  }, [momentumPeriod]);

  useEffect(() => {
    const saved = window.localStorage.getItem('si-compact-mode');
    if (saved === 'true') {
      setCompactMode(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('si-compact-mode', compactMode ? 'true' : 'false');
  }, [compactMode]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setGoalDraft(summary.dailyGoalUsd.toFixed(2));
  }, [summary.dailyGoalUsd]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setNearMatch(null);
      setSearchLoading(false);
      setSearchOpen(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/tracker/search?q=${encodeURIComponent(trimmed)}`);
        const data = await readApiResponse(response);
        if (!response.ok) {
          throw new Error(data.error ?? 'Unable to search casinos.');
        }
        setSearchResults((data.results ?? []).slice(0, 5));
        setNearMatch(data.near_match ?? null);
        setSearchOpen(true);
      } catch (error) {
        console.error(error);
        setSearchResults([]);
        setNearMatch(null);
        setSearchOpen(true);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const claimMap = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const claim of streakClaims) {
      const current = map.get(claim.casino_id) ?? [];
      current.push(claim.claimed_at);
      map.set(claim.casino_id, current);
    }
    return map;
  }, [streakClaims]);

  const casinoRows = useMemo(() => {
    const rows = casinos.map((casino) => buildCasinoRowModel(casino, claimMap.get(casino.casino_id) ?? [], nowTs));
    const hasManualSort = rows.some((row) => row.sortOrder !== null);
    return rows.sort((a, b) => {
      const statusOrder = statusRank(a.status) - statusRank(b.status);
      if (statusOrder !== 0) return statusOrder;
      if (hasManualSort) {
        const aSort = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bSort = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (aSort !== bSort) return aSort - bSort;
      }
      const aNext = nextResetSortValue(a, user.timezone);
      const bNext = nextResetSortValue(b, user.timezone);
      if (aNext !== bNext) return aNext - bNext;
      return a.name.localeCompare(b.name);
    });
  }, [casinos, claimMap, nowTs, user.timezone]);

  const dailyGoalUsd = summary.dailyGoalUsd || 5;
  const weeklyGoalUsd = summary.weeklyGoalUsd;
  const isWeekly = momentumPeriod === 'weekly' && weeklyGoalUsd !== null;
  const activeUsdEarned = isWeekly ? summary.usdEarnedWeek : summary.usdEarnedToday;
  const activeScEarned = isWeekly ? summary.scEarnedWeek : summary.scEarnedToday;
  const activeGoalUsd = isWeekly ? weeklyGoalUsd ?? dailyGoalUsd : dailyGoalUsd;
  const overGoalUsd = Math.max(0, activeUsdEarned - activeGoalUsd);
  const progressPct = activeGoalUsd > 0 ? Math.min(100, (activeUsdEarned / activeGoalUsd) * 100) : 0;
  const progressLabel = `${Math.round(progressPct)}%`;
  const spotlightCasino = discovery.casinos[0] ?? null;
  const compactDiscovery = discovery.casinos.slice(1);
  const trackedCasinoIds = useMemo(() => new Set(casinos.map((casino) => casino.casino_id)), [casinos]);
  const normalizedSearch = useMemo(() => normalizeCasinoName(searchQuery), [searchQuery]);
  const momentumFillStyle = useMemo(
    () => ({ width: `${progressPct}%`, background: MOMENTUM_GRADIENTS[summary.momentumStyle] ?? MOMENTUM_GRADIENTS.rainbow }),
    [progressPct, summary.momentumStyle],
  );

  function getMode(casinoId: number): ActionMode {
    return modeByCasino[casinoId] ?? 'daily';
  }

  function getPurchaseDraft(casinoId: number) {
    return purchaseDraftByCasino[casinoId] ?? DEFAULT_PURCHASE_DRAFT;
  }

  function setPurchaseDraft(casinoId: number, patch: Partial<PurchaseDraft>) {
    setPurchaseDraftByCasino((current) => ({
      ...current,
      [casinoId]: {
        ...getPurchaseDraft(casinoId),
        ...patch,
      },
    }));
  }

  async function refreshTracker() {
    const response = await fetch('/api/tracker/status');
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error ?? 'Unable to refresh dashboard.');
    setCasinos(data.casinos ?? []);
    setStreakClaims(data.streakClaims ?? []);
  }

  async function saveDailyGoal(nextGoal: number) {
    setGoalSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_goal_usd: nextGoal }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save goal.');
      }
      setSummary((current) => ({ ...current, dailyGoalUsd: Number(data.daily_goal_usd ?? nextGoal) }));
      setGoalEditing(false);
      setToast({ tone: 'success', message: 'Daily goal updated.' });
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to save goal.' });
    } finally {
      setGoalSaving(false);
    }
  }

  async function handleGoalCommit() {
    const nextGoal = Number(goalDraft);
    if (!Number.isFinite(nextGoal) || nextGoal < 0) {
      setToast({ tone: 'error', message: 'Enter a valid daily goal.' });
      setGoalDraft(summary.dailyGoalUsd.toFixed(2));
      setGoalEditing(false);
      return;
    }
    await saveDailyGoal(nextGoal);
  }

  async function handleAddCasino(casinoId: number, casinoName: string) {
    setPendingKey(`add:${casinoId}`);
    try {
      const response = await fetch('/api/tracker/add-casino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casino_id: casinoId }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to add casino.');
      }
      await refreshTracker();
      setSearchQuery('');
      setSearchResults([]);
      setSearchOpen(false);
      setToast({ tone: 'success', message: `${casinoName} added to dashboard.` });
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to add casino.' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleCreateCasino(name: string) {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setToast({ tone: 'error', message: 'Enter a casino name.' });
      return;
    }

    setPendingKey(`create:${trimmedName}`);
    try {
      const response = await fetch('/api/tracker/add-casino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casino_name: trimmedName }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to add casino.');
      }
      await refreshTracker();
      setSearchQuery('');
      setSearchResults([]);
      setNearMatch(null);
      setSearchOpen(false);
      setToast({ tone: 'success', message: `${trimmedName} added to your tracker.` });
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to add casino.' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleSave(casino: CasinoRowModel) {
    const mode = getMode(casino.casinoId);
    const rawAmount = amountByCasino[casino.casinoId] ?? '';
    const scAmount = rawAmount.trim() === '' ? null : Number(rawAmount);
    const note = (noteByCasino[casino.casinoId] ?? '').trim();
    const saveKey = `${mode}:${casino.casinoId}`;

    if (scAmount !== null && !Number.isFinite(scAmount)) {
      setToast({ tone: 'error', message: 'Enter a valid SC amount.' });
      return;
    }
    if ((mode === 'daily' || mode === 'spins') && scAmount !== null && scAmount < 0) {
      setInputErrorByCasino((current) => ({
        ...current,
        [casino.casinoId]: 'Use Adjust mode to subtract',
      }));
      return;
    }
    if (mode !== 'daily' && scAmount === null) {
      setToast({ tone: 'error', message: 'SC amount is required.' });
      return;
    }
    setInputErrorByCasino((current) => ({ ...current, [casino.casinoId]: '' }));

    setPendingKey(saveKey);
    try {
      let response: Response;
      if (mode === 'daily') {
        response = await fetch(MODE_META.daily.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ casino_id: casino.casinoId, claim_type: 'daily', sc_amount: scAmount }),
        });
      } else if (mode === 'adjust') {
        response = await fetch(MODE_META.adjust.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ casino_id: casino.casinoId, entry_type: 'adjustment', sc_amount: scAmount, notes: note || null }),
        });
      } else {
        response = await fetch(MODE_META.spins.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ casino_id: casino.casinoId, sc_amount: scAmount, notes: note || null }),
        });
      }

      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Unable to save entry.');

      if (mode === 'daily') {
        const claimedAt = data.claimed_at ?? new Date().toISOString();
        setCasinos((current) =>
          current.map((row) =>
            row.casino_id === casino.casinoId
              ? { ...row, today_claim_id: data.claim_id ?? -1, today_sc: scAmount, today_claimed_at: claimedAt }
              : row,
          ),
        );
        setStreakClaims((current) => [{ casino_id: casino.casinoId, claimed_at: claimedAt }, ...current]);
      }

      if (mode === 'daily' || mode === 'spins') {
        const safeScAmount = scAmount ?? 0;
        setSummary((current) => ({
          ...current,
          scEarnedToday: current.scEarnedToday + safeScAmount,
          usdEarnedToday: current.usdEarnedToday + safeScAmount * casino.scToUsdRatio,
        }));
      }

      setAmountByCasino((current) => ({ ...current, [casino.casinoId]: '' }));
      if (mode !== 'daily') setNoteByCasino((current) => ({ ...current, [casino.casinoId]: '' }));
      setToast({ tone: 'success', message: mode === 'daily' ? `${casino.name} saved.` : mode === 'adjust' ? `${casino.name} adjustment saved.` : `${casino.name} free spins saved.` });
    } catch (error) {
      console.error(error);
      if (mode === 'daily') await refreshTracker().catch((refreshError) => console.error(refreshError));
      setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Save failed.' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handlePurchaseSave(casino: CasinoRowModel) {
    const draft = getPurchaseDraft(casino.casinoId);
    const costUsd = Number(draft.costUsd);
    const scAmount = Number(draft.scAmount);
    const saveKey = `purchase:${casino.casinoId}`;

    if (!Number.isFinite(costUsd) || costUsd <= 0) {
      setToast({ tone: 'error', message: 'Enter a valid cost.' });
      return;
    }
    if (!Number.isFinite(scAmount) || scAmount <= 0) {
      setToast({ tone: 'error', message: 'Enter the SC received.' });
      return;
    }

    setPendingKey(saveKey);
    try {
      const response = await fetch('/api/tracker/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: casino.casinoId,
          cost_usd: costUsd,
          sc_amount: scAmount,
          promo_code: draft.promoCode.trim() || null,
          notes: draft.notes.trim() || null,
        }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Unable to save purchase.');
      setSummary((current) => ({ ...current, purchaseCountToday: current.purchaseCountToday + 1, purchaseUsdToday: current.purchaseUsdToday + costUsd }));
      setPurchaseDraftByCasino((current) => ({ ...current, [casino.casinoId]: DEFAULT_PURCHASE_DRAFT }));
      setPurchaseOpenByCasino((current) => ({ ...current, [casino.casinoId]: false }));
      setToast({ tone: 'success', message: `${casino.name} purchase saved.` });
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Purchase failed.' });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="dashboard-shell">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}
      <section className={`surface-card momentum-card ${momentumCollapsed ? 'momentum-card-collapsed' : ''}`}>
        <div
          className="momentum-toggle"
          role="button"
          tabIndex={0}
          onClick={() => setMomentumCollapsed((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setMomentumCollapsed((current) => !current);
            }
          }}
        >
          <div className="momentum-strip">
            <div className="period-toggle" role="tablist" aria-label="Momentum period" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className={`period-button ${momentumPeriod === 'daily' ? 'period-active' : ''}`}
                onClick={() => setMomentumPeriod('daily')}
              >
                Daily
              </button>
              <button
                type="button"
                className={`period-button ${momentumPeriod === 'weekly' ? 'period-active' : ''}`}
                onClick={() => setMomentumPeriod('weekly')}
                disabled={weeklyGoalUsd === null}
                title={weeklyGoalUsd === null ? 'Set a weekly goal in Settings first' : undefined}
              >
                Weekly
              </button>
            </div>
            <div className="momentum-inline-copy">
              <span className="momentum-captured">
                {activeScEarned.toFixed(2)} SC captured {isWeekly ? 'this week' : 'today'}
              </span>
              <span className={overGoalUsd > 0 ? 'over-goal' : 'momentum-remaining'}>
                {overGoalUsd > 0 ? `+$${overGoalUsd.toFixed(2)} over goal` : `$${Math.max(0, activeGoalUsd - activeUsdEarned).toFixed(2)} to go`}
              </span>
            </div>
            <div className="progress-row">
              <div className="progress-track" aria-hidden="true">
                <div className="progress-fill" style={momentumFillStyle} />
                {progressPct >= 15 ? <span className="progress-label progress-label-inline">{progressLabel}</span> : null}
              </div>
              {progressPct < 15 ? <span className="progress-label progress-label-side">{progressLabel}</span> : null}
            </div>
            <div className="momentum-summary">
              <span className="goal-fraction">
                ${activeUsdEarned.toFixed(2)} /
                {goalEditing ? (
                  <input
                    className="goal-input"
                    type="number"
                    min={0}
                    step={0.5}
                    value={goalDraft}
                    autoFocus
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setGoalDraft(event.target.value)}
                    onBlur={() => {
                      if (goalCancelRef.current) {
                        goalCancelRef.current = false;
                        return;
                      }
                      void handleGoalCommit();
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter') {
                        void handleGoalCommit();
                      } else if (event.key === 'Escape') {
                        goalCancelRef.current = true;
                        setGoalDraft(summary.dailyGoalUsd.toFixed(2));
                        setGoalEditing(false);
                      }
                    }}
                    disabled={goalSaving}
                  />
                ) : (
                  <button
                    type="button"
                    className="goal-edit-button"
                    disabled={isWeekly}
                    title={isWeekly ? 'Edit weekly goal in Settings' : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isWeekly) return;
                      setGoalDraft(summary.dailyGoalUsd.toFixed(2));
                      setGoalEditing(true);
                    }}
                  >
                    ${activeGoalUsd.toFixed(2)}
                    {!isWeekly ? <span className="goal-edit-hint">edit</span> : null}
                  </button>
                )}
              </span>
              <span className="collapse-indicator">{momentumCollapsed ? 'Expand' : 'Collapse'}</span>
            </div>
          </div>
        </div>
        {!momentumCollapsed ? (
          <div className="momentum-body" onClick={(event) => event.stopPropagation()}>
            <div className="momentum-inline-kpis" aria-label="Momentum highlights">
              <div className="momentum-chip">
                <span className="momentum-chip-label">USD today</span>
                <strong>${summary.usdEarnedToday.toFixed(2)}</strong>
              </div>
              <div className="momentum-chip">
                <span className="momentum-chip-label">Purchases</span>
                <strong>{summary.purchaseCountToday}</strong>
              </div>
              <div className="momentum-chip">
                <span className="momentum-chip-label">Pending</span>
                <strong>${summary.pendingRedemptionsUsd.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <div className="dashboard-main">
      <section className="surface-card dashboard-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Dashboard</h2>
            <div className="section-toolbar">
              <p className="muted section-copy">{casinoRows.length} tracked casinos. Available rows float to the top.</p>
              <button
                type="button"
                className={`compact-toggle ${compactMode ? 'compact-toggle-active' : ''}`}
                onClick={() => setCompactMode((current) => !current)}
              >
                Compact
              </button>
            </div>
          </div>
        </div>
        <div className="search-shell">
          <input
            className="search-input"
            type="text"
            placeholder="Search casinos to add..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) {
                setSearchOpen(true);
              }
            }}
          />
          {searchOpen ? (
            <div className="search-dropdown">
              {nearMatch && normalizedSearch && !trackedCasinoIds.has(nearMatch.id) ? (
                <div className="near-match-card">
                  <span className="near-match-copy">
                    Did you mean <strong>{nearMatch.name}</strong>?
                  </span>
                  <div className="near-match-actions">
                    <button type="button" className="search-add" onClick={() => void handleAddCasino(nearMatch.id, nearMatch.name)}>
                      Yes, use this
                    </button>
                    <button
                      type="button"
                      className="search-add search-add-ghost"
                      onClick={() => void handleCreateCasino(searchQuery)}
                      disabled={pendingKey === `create:${searchQuery.trim()}`}
                    >
                      No, add as {`"${searchQuery.trim()}"`}
                    </button>
                  </div>
                </div>
              ) : null}
              {searchLoading ? <div className="search-empty">Searching...</div> : null}
              {!searchLoading && searchResults.length > 0 ? (
                searchResults.map((result) => {
                  const addPending = pendingKey === `add:${result.id}`;
                  const alreadyTracking = trackedCasinoIds.has(result.id);
                  return (
                    <div key={result.id} className={`search-result ${alreadyTracking ? 'search-result-tracked' : ''}`}>
                      <div className="search-result-copy">
                        <span className="search-result-name">{result.name}</span>
                        {result.tier ? (
                          <span className="tier-badge" style={getTierBadgeStyle(result.tier)}>{result.tier}</span>
                        ) : null}
                      </div>
                      {alreadyTracking ? (
                        <span className="search-tracked">Already tracking</span>
                      ) : (
                        <button type="button" className="search-add" onClick={() => void handleAddCasino(result.id, result.name)} disabled={addPending}>
                          {addPending ? 'Adding...' : 'Add'}
                        </button>
                      )}
                    </div>
                  );
                })
              ) : null}
              {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
                <div className="search-empty">
                  <span>No casinos found.</span>
                  <span className="search-suggest">Suggest a casino</span>
                </div>
              ) : null}
              {!searchLoading && searchQuery.trim().length >= 2 && !nearMatch ? (
                <button
                  type="button"
                  className="add-typed-button"
                  onClick={() => void handleCreateCasino(searchQuery)}
                  disabled={pendingKey === `create:${searchQuery.trim()}`}
                >
                  {pendingKey === `create:${searchQuery.trim()}` ? 'Adding...' : `Add "${searchQuery.trim()}"`}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {casinoRows.length === 0 ? (
          <div className="empty-state"><p>No casinos are being tracked yet.</p><a href="/casinos">Browse casinos</a></div>
        ) : bootstrapping ? (
          <div className="dashboard-loading">
            <div className="muted">Loading current claim windows...</div>
          </div>
        ) : (
          <div className={`casino-list ${compactMode ? 'casino-list-compact' : ''}`}>
            {casinoRows.map((casino) => {
              const mode = getMode(casino.casinoId);
              const meta = MODE_META[mode];
              const purchaseOpen = purchaseOpenByCasino[casino.casinoId] ?? false;
              const purchaseDraft = getPurchaseDraft(casino.casinoId);
              const actionPending = pendingKey === `${mode}:${casino.casinoId}`;
              const purchasePending = pendingKey === `purchase:${casino.casinoId}`;
              const statusDisplay = getCasinoStatusDisplay(casino, user.timezone, nowTs);
              const inputError = inputErrorByCasino[casino.casinoId];

              return (
                <article key={casino.casinoId} id={`casino-${casino.casinoId}`} className={`casino-row ${statusDisplay.isDue ? 'casino-row-due' : ''} ${compactMode ? 'casino-row-compact' : ''}`}>
                  <div className="casino-main">
                    <div className="casino-copy">
                      <div className="casino-heading">
                        <a href={`/casinos/${casino.slug}`} className="casino-link">{casino.name}</a>
                        {casino.tier ? (
                          <span className="tier-badge" style={getTierBadgeStyle(casino.tier)}>{casino.tier}</span>
                        ) : null}
                      </div>
                      <div className="casino-meta">
                        {casino.noDailyReward ? (
                          <span className="muted">No daily reward</span>
                        ) : (
                          <div className="status-stack">
                            <div className="status-primary">
                              {statusDisplay.isDue ? <span className="due-pill">DUE</span> : null}
                              <span className={statusDisplay.primaryClassName}>{statusDisplay.primary}</span>
                            </div>
                            {statusDisplay.secondary ? <span className={statusDisplay.secondaryClassName}>{statusDisplay.secondary}</span> : null}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="action-stack">
                      <div className="mode-toggle">
                        {(['daily', 'adjust', 'spins'] as ActionMode[]).map((modeOption) => (
                          <button
                            key={modeOption}
                            type="button"
                            className={`mode-pill ${mode === modeOption ? 'mode-pill-active' : ''}`}
                            style={mode === modeOption ? { borderColor: MODE_META[modeOption].accent, color: MODE_META[modeOption].accent, background: 'rgba(255, 255, 255, 0.02)' } : undefined}
                            onClick={() => setModeByCasino((current) => ({ ...current, [casino.casinoId]: modeOption }))}
                          >
                            {MODE_META[modeOption].label}
                          </button>
                        ))}
                        <button type="button" className={`buy-button ${purchaseOpen ? 'buy-button-open' : ''}`} onClick={() => setPurchaseOpenByCasino((current) => ({ ...current, [casino.casinoId]: !purchaseOpen }))}>+ Buy</button>
                      </div>
                      <div className="entry-row">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={mode === 'adjust' ? undefined : 0}
                          placeholder="SC amount"
                          value={amountByCasino[casino.casinoId] ?? ''}
                          onChange={(event) => {
                            setAmountByCasino((current) => ({ ...current, [casino.casinoId]: event.target.value }));
                            if (inputError) {
                              setInputErrorByCasino((current) => ({ ...current, [casino.casinoId]: '' }));
                            }
                          }}
                          disabled={actionPending || (mode === 'daily' && casino.status !== 'available')}
                        />
                        {mode !== 'daily' ? <input placeholder="Description" value={noteByCasino[casino.casinoId] ?? ''} onChange={(event) => setNoteByCasino((current) => ({ ...current, [casino.casinoId]: event.target.value }))} disabled={actionPending} /> : null}
                        <button type="button" className="save-button" style={{ background: meta.accent }} onClick={() => void handleSave(casino)} disabled={actionPending || (mode === 'daily' && casino.status !== 'available')}>{actionPending ? 'Saving...' : meta.saveLabel}</button>
                      </div>
                      {inputError ? <div className="entry-error">{inputError}</div> : null}
                    </div>
                  </div>
                  {purchaseOpen ? (
                    <div className="purchase-panel">
                      <div className="purchase-grid">
                        <input inputMode="decimal" placeholder="Cost USD" value={purchaseDraft.costUsd} onChange={(event) => setPurchaseDraft(casino.casinoId, { costUsd: event.target.value })} disabled={purchasePending} />
                        <input inputMode="decimal" placeholder="SC received" value={purchaseDraft.scAmount} onChange={(event) => setPurchaseDraft(casino.casinoId, { scAmount: event.target.value })} disabled={purchasePending} />
                        <input placeholder="Promo code" value={purchaseDraft.promoCode} onChange={(event) => setPurchaseDraft(casino.casinoId, { promoCode: event.target.value })} disabled={purchasePending} />
                        <input placeholder="Notes" value={purchaseDraft.notes} onChange={(event) => setPurchaseDraft(casino.casinoId, { notes: event.target.value })} disabled={purchasePending} />
                      </div>
                      <div className="purchase-actions">
                        <button type="button" className="ghost-button" onClick={() => setPurchaseOpenByCasino((current) => ({ ...current, [casino.casinoId]: false }))} disabled={purchasePending}>Cancel</button>
                        <button type="button" className="purchase-save" onClick={() => void handlePurchaseSave(casino)} disabled={purchasePending}>{purchasePending ? 'Saving...' : 'Save Purchase'}</button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {spotlightCasino ? (
        <aside className="surface-card discovery-sidebar">
          <div className="discovery-header">
            <div>
              <div className="eyebrow">Casinos you're missing</div>
              <p className="muted section-copy">
                {discovery.homeState ? `Personalized for ${discovery.homeState}` : 'Based on your activity'}
              </p>
            </div>
          </div>

          <div className="discovery-spotlight">
            <div className="spotlight-copy">
              <div className="spotlight-topline">
                <div className="spotlight-heading">
                  <a href={`/casinos/${spotlightCasino.slug}`} className="spotlight-title">{spotlightCasino.name}</a>
                  {spotlightCasino.tier ? (
                    <span className="tier-badge" style={getTierBadgeStyle(spotlightCasino.tier)}>{spotlightCasino.tier}</span>
                  ) : null}
                </div>
                <span className="health-pill" style={getDiscoveryHealthStyle(spotlightCasino.promoban_risk)}>
                  {getDiscoveryHealthLabel(spotlightCasino.promoban_risk)}
                </span>
              </div>
              <p className="spotlight-pitch">{buildDiscoveryPitch(spotlightCasino)}</p>
              <div className="spotlight-facts">
                {buildSpotlightFacts(spotlightCasino).map((fact) => (
                  <div key={fact.label} className="spotlight-fact">
                    <span className="spotlight-fact-label">{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="spotlight-actions">
              <a href={`/casinos/${spotlightCasino.slug}`} className="spotlight-secondary">Full Profile {'->'}</a>
              <a
                href={spotlightCasino.has_affiliate_link && spotlightCasino.affiliate_link_url ? spotlightCasino.affiliate_link_url : `/casinos/${spotlightCasino.slug}`}
                className="spotlight-primary"
                target={spotlightCasino.has_affiliate_link && spotlightCasino.affiliate_link_url ? '_blank' : undefined}
                rel={spotlightCasino.has_affiliate_link && spotlightCasino.affiliate_link_url ? 'noopener noreferrer' : undefined}
              >
                Sign Up {'->'}
              </a>
            </div>
          </div>

          {compactDiscovery.length > 0 ? (
            <div className="discovery-grid">
              {compactDiscovery.map((casino) => (
                <article key={casino.id} className="discovery-card">
                  <div className="discovery-card-head">
                    <div>
                      <a href={`/casinos/${casino.slug}`} className="discovery-card-title">{casino.name}</a>
                      <div className="discovery-card-meta">
                        <span>{getDiscoveryLead(casino)}</span>
                      </div>
                    </div>
                    {casino.tier ? (
                      <span className="tier-badge" style={getTierBadgeStyle(casino.tier)}>{casino.tier}</span>
                    ) : null}
                  </div>
                  <p className="discovery-card-copy">{buildCompactPitch(casino)}</p>
                  <div className="discovery-card-actions">
                    <a href={`/casinos/${casino.slug}`} className="discovery-link">Profile</a>
                    <a
                      href={casino.has_affiliate_link && casino.affiliate_link_url ? casino.affiliate_link_url : `/casinos/${casino.slug}`}
                      className="discovery-link discovery-link-primary"
                      target={casino.has_affiliate_link && casino.affiliate_link_url ? '_blank' : undefined}
                      rel={casino.has_affiliate_link && casino.affiliate_link_url ? 'noopener noreferrer' : undefined}
                    >
                      Sign Up
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          <a href="/casinos" className="explore-link">Explore All Casinos {'->'}</a>
        </aside>
      ) : null}
      </div>

      <style>{`
        .dashboard-shell { display: grid; gap: 1.25rem; min-width: 0; overflow-x: clip; }
        .dashboard-main { display: grid; gap: 1.2rem; grid-template-columns: minmax(0, 1fr) 380px; align-items: start; min-width: 0; overflow-x: clip; }
        .momentum-card, .dashboard-section, .discovery-sidebar { padding: 1.2rem; }
        .momentum-card { padding-block: 0.85rem; }
        .momentum-card-collapsed { min-height: 48px; }
        .momentum-toggle { display: grid; gap: 0.9rem; width: 100%; background: transparent; color: inherit; padding: 0; text-align: left; cursor: pointer; }
        .section-header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
        .eyebrow { color: var(--text-muted); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
        .momentum-strip { display: grid; gap: 0.8rem; grid-template-columns: auto auto minmax(220px, 1fr) auto; align-items: center; }
        .momentum-inline-copy { display: flex; gap: 0.8rem; flex-wrap: wrap; align-items: center; }
        .momentum-summary { display: grid; gap: 0.2rem; justify-items: end; font-weight: 700; }
        .goal-fraction { font-size: 1.05rem; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap; }
        .goal-edit-button { border: none; background: transparent; color: var(--text-primary); font: inherit; font-weight: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0; }
        .goal-edit-button:disabled { cursor: default; opacity: 0.92; }
        .goal-edit-hint { opacity: 0; color: var(--text-muted); font-size: 0.78rem; font-weight: 700; transition: opacity 140ms ease; }
        .goal-edit-button:hover .goal-edit-hint { opacity: 1; }
        .goal-input { width: 5rem; border-radius: 0.7rem; border: 1px solid var(--color-border); background: var(--bg-primary); color: var(--text-primary); padding: 0.35rem 0.5rem; font: inherit; font-weight: 800; }
        .collapse-indicator { color: var(--text-muted); font-size: 0.9rem; }
        .progress-row { display: flex; gap: 0.55rem; align-items: center; }
        .progress-track { position: relative; flex: 1 1 auto; height: 18px; border-radius: 999px; background: var(--bg-primary); border: 1px solid var(--color-border); overflow: hidden; }
        .progress-fill { height: 100%; border-radius: inherit; background: var(--progress-gradient); transition: width 180ms ease; }
        .progress-label { color: #fff; font-size: 0.85rem; font-weight: 800; letter-spacing: 0.02em; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35); }
        .progress-label-inline { position: absolute; inset: 0; display: grid; place-items: center; }
        .progress-label-side { color: var(--text-primary); min-width: 2.5rem; text-align: right; }
        .momentum-captured { color: var(--text-primary); font-weight: 700; }
        .momentum-remaining { color: var(--accent-yellow); font-weight: 700; }
        .over-goal { color: var(--accent-green); font-weight: 700; }
        .momentum-body { margin-top: 0.9rem; border-top: 1px solid var(--color-border); padding-top: 0.9rem; display: flex; justify-content: flex-end; gap: 1rem; flex-wrap: wrap; align-items: center; }
        .period-toggle { display: inline-flex; gap: 0.5rem; padding: 0.35rem; border-radius: 999px; background: var(--bg-primary); border: 1px solid var(--color-border); }
        .period-button { border: none; background: transparent; color: var(--text-secondary); border-radius: 999px; padding: 0.55rem 0.9rem; cursor: pointer; font-weight: 700; }
        .period-button:disabled { opacity: 0.5; cursor: not-allowed; }
        .period-active { background: rgba(59, 130, 246, 0.16); color: var(--text-primary); }
        .momentum-inline-kpis { display: flex; gap: 0.65rem; flex-wrap: wrap; justify-content: flex-end; }
        .momentum-chip { display: grid; gap: 0.15rem; min-width: 110px; padding: 0.7rem 0.85rem; border-radius: 1rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.48); }
        .momentum-chip-label { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .section-copy { margin: 0; }
        .section-toolbar { display: flex; gap: 0.85rem; align-items: center; flex-wrap: wrap; }
        .compact-toggle {
          border: 1px solid var(--color-border);
          border-radius: 999px;
          background: var(--bg-primary);
          color: var(--text-secondary);
          padding: 0.48rem 0.82rem;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .compact-toggle-active {
          color: var(--text-primary);
          border-color: rgba(59, 130, 246, 0.35);
          background: rgba(59, 130, 246, 0.12);
        }
        .dashboard-section { display: grid; gap: 1rem; max-height: calc(100vh - 165px); overflow-y: auto; min-width: 0; }
        .search-shell { position: relative; min-width: 0; }
        .search-input {
          width: 100%;
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 0.88rem 1rem;
          font: inherit;
        }
        .search-dropdown {
          position: absolute;
          z-index: 5;
          top: calc(100% + 0.5rem);
          left: 0;
          right: 0;
          display: grid;
          gap: 0.35rem;
          padding: 0.5rem;
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          background: var(--bg-secondary);
          box-shadow: 0 18px 40px rgba(2, 6, 23, 0.42);
        }
        .search-result {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          border-radius: 0.9rem;
          padding: 0.65rem 0.7rem;
          background: rgba(17, 24, 39, 0.45);
        }
        .search-result-copy { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; min-width: 0; }
        .search-result-name { color: var(--text-primary); font-weight: 700; }
        .search-add { border: none; border-radius: 999px; background: var(--accent-blue); color: var(--text-primary); padding: 0.58rem 0.9rem; font: inherit; font-weight: 700; cursor: pointer; }
        .search-add-ghost { background: transparent; border: 1px solid var(--color-border); color: var(--text-secondary); }
        .search-result-tracked { opacity: 0.65; }
        .search-tracked { color: var(--text-muted); font-size: 0.88rem; font-weight: 700; }
        .near-match-card { display: grid; gap: 0.5rem; padding: 0.75rem; border-radius: 0.95rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); }
        .near-match-copy { color: var(--text-primary); }
        .near-match-actions { display: flex; gap: 0.55rem; flex-wrap: wrap; }
        .search-empty { display: grid; gap: 0.2rem; padding: 0.7rem 0.8rem; color: var(--text-secondary); }
        .search-suggest { color: var(--text-muted); font-size: 0.88rem; }
        .add-typed-button { border: 1px dashed var(--color-border); border-radius: 0.95rem; background: transparent; color: var(--text-primary); padding: 0.8rem 0.9rem; font: inherit; font-weight: 700; text-align: left; cursor: pointer; }
        .casino-list { display: grid; gap: 0.85rem; min-width: 0; }
        .casino-row { display: grid; gap: 0.9rem; padding: 1rem; border-radius: 1.2rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.52); scroll-margin-top: 7rem; }
        .casino-list .casino-row:nth-child(odd) { background: rgba(17, 24, 39, 0.38); }
        .casino-list .casino-row:nth-child(even) { background: rgba(17, 24, 39, 0.52); }
        .casino-row-due { border-left: 3px solid var(--accent-green); }
        .casino-row:target { border-color: rgba(59, 130, 246, 0.52); box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.18), 0 18px 40px rgba(2, 6, 23, 0.38); }
        .casino-main { display: flex; gap: 1rem; justify-content: space-between; align-items: center; min-width: 0; }
        .casino-copy { display: grid; gap: 0.45rem; min-width: 0; }
        .casino-heading { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; }
        .casino-link { color: var(--text-primary); text-decoration: none; font-size: 1.08rem; font-weight: 800; letter-spacing: -0.03em; }
        .tier-badge { display: inline-flex; min-width: 2rem; justify-content: center; border-radius: 999px; padding: 0.25rem 0.55rem; font-size: 0.78rem; font-weight: 800; border: 1px solid transparent; }
        .casino-meta { display: flex; gap: 0.85rem; flex-wrap: wrap; align-items: center; font-size: 0.92rem; }
        .status-stack { display: grid; gap: 0.18rem; }
        .status-primary { display: flex; gap: 0.55rem; align-items: center; flex-wrap: wrap; }
        .status-available { color: var(--text-primary); font-weight: 700; }
        .status-claimed, .status-countdown { color: var(--text-secondary); font-weight: 700; }
        .status-secondary { color: var(--text-muted); font-size: 0.84rem; }
        .status-secondary-amber { color: var(--accent-yellow); font-size: 0.84rem; font-weight: 700; }
        .due-pill { display: inline-flex; align-items: center; padding: 0.22rem 0.55rem; border-radius: 999px; background: var(--accent-green); color: #fff; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
        .action-stack { display: grid; gap: 0.7rem; width: min(100%, 520px); justify-items: end; min-width: 0; }
        .mode-toggle, .entry-row, .purchase-actions { display: flex; gap: 0.55rem; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
        .mode-pill, .buy-button, .save-button, .ghost-button, .purchase-save { border-radius: 999px; font-weight: 700; cursor: pointer; }
        .mode-pill, .buy-button, .ghost-button { border: 1px solid var(--color-border); background: var(--bg-primary); color: var(--text-secondary); padding: 0.58rem 0.82rem; }
        .buy-button-open { color: var(--accent-blue); border-color: var(--accent-blue); }
        .entry-row input, .purchase-grid input { border-radius: 0.85rem; border: 1px solid var(--color-border); background: var(--bg-primary); color: var(--text-primary); padding: 0.72rem 0.82rem; min-width: 0; }
        .entry-row input { min-width: 140px; flex: 1 1 140px; }
        .entry-error { color: var(--accent-red); font-size: 0.84rem; font-weight: 700; justify-self: end; }
        .save-button, .purchase-save { border: none; color: #0b1220; padding: 0.74rem 1rem; }
        .save-button:disabled, .purchase-save:disabled, .mode-pill:disabled, .buy-button:disabled, .ghost-button:disabled { cursor: not-allowed; opacity: 0.65; }
        .purchase-panel { display: grid; gap: 0.75rem; padding-top: 0.9rem; border-top: 1px solid var(--color-border); }
        .purchase-grid { display: grid; gap: 0.7rem; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .ghost-button { color: var(--text-primary); }
        .purchase-save { background: var(--accent-blue); }
        .empty-state { display: grid; gap: 0.45rem; justify-items: start; padding: 1rem 0.25rem 0.25rem; }
        .empty-state p { margin: 0; color: var(--text-secondary); }
        .dashboard-loading { padding: 1rem 0.25rem 0.25rem; }
        .discovery-sidebar {
          display: grid;
          gap: 1rem;
          position: sticky;
          top: 80px;
          max-height: calc(100vh - 100px);
          overflow-y: auto;
          background: rgba(17, 24, 39, 0.65);
          border-left: 1px solid var(--color-border);
        }
        .discovery-header { display: grid; gap: 0.35rem; }
        .discovery-spotlight { display: grid; gap: 1rem; padding: 1.15rem; border-radius: 1.35rem; border: 1px solid rgba(59, 130, 246, 0.24); background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(17, 24, 39, 0.58)); }
        .spotlight-copy { display: grid; gap: 0.9rem; }
        .spotlight-topline { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
        .spotlight-heading { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; }
        .spotlight-title { color: var(--text-primary); text-decoration: none; font-size: 1.45rem; font-weight: 800; letter-spacing: -0.04em; }
        .health-pill { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.32rem 0.6rem; border-radius: 999px; border: 1px solid currentColor; font-size: 0.8rem; font-weight: 700; }
        .spotlight-pitch, .discovery-card-copy { margin: 0; color: var(--text-secondary); line-height: 1.65; }
        .spotlight-facts { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .spotlight-fact { display: grid; gap: 0.28rem; padding: 0.85rem; border-radius: 1rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.48); }
        .spotlight-fact-label { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .spotlight-actions { display: grid; gap: 0.65rem; align-content: end; }
        .spotlight-primary, .spotlight-secondary, .discovery-link { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0.78rem 1rem; text-decoration: none; font-weight: 700; white-space: nowrap; }
        .spotlight-primary, .discovery-link-primary { background: var(--accent-green); color: #0b1220; font-weight: 800; }
        .spotlight-secondary, .discovery-link { border: 1px solid var(--color-border); color: var(--text-primary); background: rgba(17, 24, 39, 0.42); }
        .discovery-grid { display: grid; gap: 0.9rem; grid-template-columns: 1fr; }
        .discovery-card { display: grid; gap: 0.85rem; padding: 1rem; border-radius: 1.2rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.46); }
        .discovery-card-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; }
        .discovery-card-title { color: var(--text-primary); text-decoration: none; font-size: 1rem; font-weight: 800; letter-spacing: -0.03em; }
        .discovery-card-meta { display: flex; align-items: center; gap: 0.45rem; color: var(--text-muted); font-size: 0.86rem; margin-top: 0.3rem; }
        .discovery-card-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
        .explore-link { color: var(--accent-blue); text-decoration: none; font-weight: 700; }
        .toast { position: sticky; top: 1rem; z-index: 15; justify-self: center; padding: 0.8rem 1rem; border-radius: 999px; font-weight: 700; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3); }
        .toast-success { background: rgba(16, 185, 129, 0.16); color: var(--accent-green); }
        .toast-error { background: rgba(239, 68, 68, 0.16); color: var(--accent-red); }
        .casino-row-compact { padding: 0.6rem; }
        .casino-row-compact .casino-link { font-size: 0.95rem; }
        .casino-row-compact .mode-pill,
        .casino-row-compact .buy-button,
        .casino-row-compact .save-button,
        .casino-row-compact .ghost-button,
        .casino-row-compact .purchase-save { padding: 0.55rem 0.8rem; font-size: 0.88rem; }
        .casino-row-compact .status-secondary,
        .casino-row-compact .status-secondary-amber { display: none; }
        @media (max-width: 1180px) { .purchase-grid, .spotlight-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } .spotlight-actions { grid-auto-flow: column; justify-content: flex-start; } }
        @media (max-width: 1024px) { .dashboard-main { grid-template-columns: 1fr; } .dashboard-section, .discovery-sidebar { max-height: none; overflow: visible; position: static; } .discovery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 780px) { .momentum-strip { grid-template-columns: 1fr; } .casino-main { flex-direction: column; align-items: stretch; } .action-stack { width: 100%; justify-items: stretch; } .mode-toggle, .entry-row, .purchase-actions, .momentum-inline-kpis { justify-content: flex-start; } .momentum-body { align-items: stretch; } .momentum-summary { justify-items: start; } }
        @media (max-width: 640px) { .purchase-grid, .spotlight-facts, .discovery-grid { grid-template-columns: 1fr; } .entry-row input, .purchase-grid input, .save-button, .purchase-save, .ghost-button, .spotlight-primary, .spotlight-secondary, .discovery-link { width: 100%; } .spotlight-actions, .discovery-card-actions { grid-auto-flow: row; display: grid; } }
      `}</style>
    </div>
  );
}

function normalizeCasinoName(name: string) {
  return name
    .toLowerCase()
    .replace(/\.com|\.net/g, '')
    .replace(/casino|sweeps|sweepstakes/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function buildCasinoRowModel(casino: TrackerCasinoRow, claims: string[], nowTs: number): CasinoRowModel {
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

function statusRank(status: CasinoStatus) {
  if (status === 'available') return 0;
  if (status === 'countdown') return 1;
  if (status === 'claimed') return 2;
  return 3;
}

function nextResetSortValue(casino: CasinoRowModel, userTimezone: string) {
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

function getCasinoStatusDisplay(casino: CasinoRowModel, userTimezone: string, nowTs: number) {
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

function getTierBadgeStyle(tier: string) {
  if (tier === 'S') return { background: 'rgba(245, 158, 11, 0.16)', color: 'var(--accent-yellow)', borderColor: 'rgba(245, 158, 11, 0.32)' };
  if (tier === 'A') return { background: 'rgba(16, 185, 129, 0.16)', color: 'var(--accent-green)', borderColor: 'rgba(16, 185, 129, 0.32)' };
  if (tier === 'B') return { background: 'rgba(59, 130, 246, 0.16)', color: 'var(--accent-blue)', borderColor: 'rgba(59, 130, 246, 0.32)' };
  return { background: 'rgba(156, 163, 175, 0.12)', color: 'var(--text-secondary)', borderColor: 'rgba(156, 163, 175, 0.26)' };
}

function getDiscoveryHealthStyle(risk: string | null) {
  if (risk === 'none' || risk === 'low') {
    return { color: 'var(--accent-green)', background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.24)' };
  }
  if (risk === 'high') {
    return { color: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.24)' };
  }
  return { color: 'var(--accent-yellow)', background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.24)' };
}

function getDiscoveryHealthLabel(risk: string | null) {
  if (risk === 'none' || risk === 'low') return 'Low risk';
  if (risk === 'high') return 'Caution';
  return 'Watch list';
}

function buildDiscoveryPitch(casino: DashboardDiscoveryCasino) {
  const fragments = [
    casino.daily_bonus_desc ? `${casino.daily_bonus_desc}.` : null,
    casino.redemption_speed_desc ? `Redemptions: ${casino.redemption_speed_desc}.` : null,
    casino.has_live_games ? 'Live tables are available, so keep your account setup disciplined.' : 'Built more for routine daily extraction than live-table complexity.',
  ].filter(Boolean);

  return fragments.join(' ');
}

function buildCompactPitch(casino: DashboardDiscoveryCasino) {
  if (casino.daily_bonus_desc && casino.redemption_speed_desc) {
    return `${casino.daily_bonus_desc}. ${casino.redemption_speed_desc}.`;
  }
  if (casino.daily_bonus_desc) return `${casino.daily_bonus_desc}.`;
  if (casino.redemption_speed_desc) return `${casino.redemption_speed_desc}.`;
  if (casino.intel_count > 0) return `${casino.intel_count} recent intel items are already feeding this profile.`;
  return 'Profile coverage is live and ready when you want to dig deeper.';
}

function getDiscoveryLead(casino: DashboardDiscoveryCasino) {
  if (casino.redemption_speed_desc) return casino.redemption_speed_desc;
  if (casino.daily_bonus_desc) return casino.daily_bonus_desc;
  if (casino.intel_count > 0) return `${casino.intel_count} intel notes`;
  return 'Profile ready';
}

function buildSpotlightFacts(casino: DashboardDiscoveryCasino) {
  return [
    { label: 'Daily bonus', value: casino.daily_bonus_desc ?? 'Details coming soon' },
    { label: 'Redeem speed', value: casino.redemption_speed_desc ?? 'Unknown' },
    { label: 'PB risk', value: getDiscoveryHealthLabel(casino.promoban_risk) },
    { label: 'Signal', value: casino.intel_count > 0 ? `${casino.intel_count} live intel items` : `${casino.tracker_count} trackers watching` },
  ];
}

function formatLastClaim(value: string, timezone: string) {
  const dt = DateTime.fromISO(value).setZone(timezone);
  return dt.isValid ? dt.toFormat("MMM d, h:mm a") : null;
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

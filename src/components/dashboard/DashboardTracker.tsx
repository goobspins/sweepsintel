import { useEffect, useMemo, useRef, useState } from 'react';

import type { ActionMode, DashboardTrackerProps, PurchaseDraft, ToastState } from './types';
import { DEFAULT_PURCHASE_DRAFT, MODE_META, buildCasinoRowModel, getCasinoStatusDisplay, nextResetSortValue, statusRank } from './utils';
import MomentumStrip from './MomentumStrip';
import CasinoSearch from './CasinoSearch';
import CasinoRow from './CasinoRow';
import DiscoverySidebar from './DiscoverySidebar';
import UnderfoldSection from './UnderfoldSection';

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

export default function DashboardTracker({
  user,
  initialData,
  initialSummary,
  initialDiscovery,
}: DashboardTrackerProps) {
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
  const [momentumPeriod, setMomentumPeriod] = useState<'daily' | 'weekly'>(() => initialSummary.momentumPeriod ?? 'daily');
  const [compactMode, setCompactMode] = useState(false);
  const [layoutSwap, setLayoutSwap] = useState(Boolean(user.layoutSwap));
  const [discoveryCollapsed, setDiscoveryCollapsed] = useState(false);

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
    const saved = window.sessionStorage.getItem('si-discovery-collapsed');
    if (saved === 'true') {
      setDiscoveryCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem('si-discovery-collapsed', discoveryCollapsed ? 'true' : 'false');
  }, [discoveryCollapsed]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setGoalDraft(summary.dailyGoalUsd.toFixed(2));
  }, [summary.dailyGoalUsd]);

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

  const spotlightCasino = discovery.casinos[0] ?? null;
  const compactDiscovery = discovery.casinos.slice(1);
  const fullDiscovery = discovery.casinos;
  const trackedCasinoIds = useMemo(() => new Set(casinos.map((casino) => casino.casino_id)), [casinos]);
  const useSidebarDiscovery = Boolean(spotlightCasino && casinoRows.length >= 6 && !discoveryCollapsed);

  function getMode(casinoId: number) {
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

  async function handleLayoutSwapToggle() {
    const nextValue = !layoutSwap;
    setLayoutSwap(nextValue);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_swap: nextValue }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save dashboard layout.');
      }
    } catch (error) {
      console.error(error);
      setLayoutSwap((current) => !current);
      setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to save dashboard layout.' });
    }
  }

  async function handleGoalCommit() {
    if (goalCancelRef.current) {
      goalCancelRef.current = false;
      return;
    }

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
      setToast({ tone: 'success', message: `${trimmedName} added to your tracker.` });
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to add casino.' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleSave(casino: (typeof casinoRows)[number]) {
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
      if (mode !== 'daily') {
        setNoteByCasino((current) => ({ ...current, [casino.casinoId]: '' }));
      }
      setToast({
        tone: 'success',
        message:
          mode === 'daily'
            ? `${casino.name} saved.`
            : mode === 'adjust'
              ? `${casino.name} adjustment saved.`
              : `${casino.name} free spins saved.`,
      });
    } catch (error) {
      console.error(error);
      if (mode === 'daily') {
        await refreshTracker().catch((refreshError) => console.error(refreshError));
      }
      setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Save failed.' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handlePurchaseSave(casino: (typeof casinoRows)[number]) {
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
      setSummary((current) => ({
        ...current,
        purchaseCountToday: current.purchaseCountToday + 1,
        purchaseUsdToday: current.purchaseUsdToday + costUsd,
      }));
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

      <MomentumStrip
        summary={summary}
        momentumPeriod={momentumPeriod}
        onPeriodChange={setMomentumPeriod}
        goalEditing={goalEditing}
        goalDraft={goalDraft}
        goalSaving={goalSaving}
        momentumCollapsed={momentumCollapsed}
        onToggleCollapsed={() => setMomentumCollapsed((current) => !current)}
        onGoalDraftChange={setGoalDraft}
        onGoalEditStart={() => {
          setGoalDraft(summary.dailyGoalUsd.toFixed(2));
          setGoalEditing(true);
        }}
        onGoalEditCancel={() => {
          goalCancelRef.current = true;
          setGoalDraft(summary.dailyGoalUsd.toFixed(2));
          setGoalEditing(false);
        }}
        onGoalCommit={handleGoalCommit}
      />

      <div
        className={`dashboard-main ${useSidebarDiscovery ? 'dashboard-main-sidebar' : 'dashboard-main-stacked'} ${
          layoutSwap ? 'dashboard-main-swapped' : ''
        }`}
      >
        <div className="dashboard-column dashboard-column-primary">
          <section className="surface-card dashboard-section">
            <div className="section-header">
              <div>
                <div className="eyebrow">Casino Dashboard</div>
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
                  <button type="button" className="compact-toggle" onClick={() => void handleLayoutSwapToggle()}>
                    Swap sides
                  </button>
                </div>
              </div>
            </div>

            <CasinoSearch
              trackedCasinoIds={trackedCasinoIds}
              onAddCasino={handleAddCasino}
              onCreateCasino={handleCreateCasino}
              pendingKey={pendingKey}
            />

            {casinoRows.length === 0 ? (
              <div className="empty-state">
                <p>No casinos are being tracked yet.</p>
                <a href="/casinos">Browse casinos</a>
              </div>
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

                  return (
                    <CasinoRow
                      key={casino.casinoId}
                      casino={casino}
                      mode={mode}
                      meta={meta}
                      amount={amountByCasino[casino.casinoId] ?? ''}
                      note={noteByCasino[casino.casinoId] ?? ''}
                      inputError={inputErrorByCasino[casino.casinoId] ?? ''}
                      purchaseOpen={purchaseOpen}
                      purchaseDraft={purchaseDraft}
                      actionPending={actionPending}
                      purchasePending={purchasePending}
                      compactMode={compactMode}
                      statusDisplay={statusDisplay}
                      onModeChange={(casinoId, nextMode) =>
                        setModeByCasino((current) => ({ ...current, [casinoId]: nextMode }))
                      }
                      onAmountChange={(casinoId, value) => {
                        setAmountByCasino((current) => ({ ...current, [casinoId]: value }));
                        if (inputErrorByCasino[casinoId]) {
                          setInputErrorByCasino((current) => ({ ...current, [casinoId]: '' }));
                        }
                      }}
                      onNoteChange={(casinoId, value) =>
                        setNoteByCasino((current) => ({ ...current, [casinoId]: value }))
                      }
                      onSave={(targetCasino) => void handleSave(targetCasino)}
                      onPurchaseToggle={(casinoId) =>
                        setPurchaseOpenByCasino((current) => ({ ...current, [casinoId]: !current[casinoId] }))
                      }
                      onPurchaseDraftChange={(casinoId, patch) => setPurchaseDraft(casinoId, patch)}
                      onPurchaseSave={(targetCasino) => void handlePurchaseSave(targetCasino)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {useSidebarDiscovery && spotlightCasino ? (
          <div className="dashboard-column dashboard-column-secondary">
            <DiscoverySidebar
              discovery={discovery}
              spotlightCasino={spotlightCasino}
              compactDiscovery={compactDiscovery}
              onToggleCollapse={() => setDiscoveryCollapsed(true)}
            />
          </div>
        ) : null}
      </div>

      {discoveryCollapsed && casinoRows.length >= 6 ? (
        <button
          type="button"
          className="discovery-expand-tab"
          onClick={() => setDiscoveryCollapsed(false)}
          aria-label="Expand discovery"
        >
          {'<'} Discovery
        </button>
      ) : null}

      <UnderfoldSection
        discovery={discovery}
        fullDiscovery={fullDiscovery}
        casinoCount={casinoRows.length}
        showDiscoveryGrid={!useSidebarDiscovery}
      />

      <style>{`
        .dashboard-shell { display: grid; gap: 1.1rem; min-width: 0; overflow-x: clip; }
        .dashboard-main { display: grid; gap: 1.2rem; min-width: 0; align-items: stretch; }
        .dashboard-main-sidebar { grid-template-columns: minmax(0, 1fr) 380px; }
        .dashboard-main-stacked { grid-template-columns: 1fr; }
        .dashboard-main-swapped .dashboard-column-primary { order: 2; }
        .dashboard-main-swapped .dashboard-column-secondary { order: 1; }
        .dashboard-column { min-width: 0; display: grid; align-content: start; }
        .dashboard-section { display: grid; gap: 1rem; padding: 1.2rem; align-self: start; min-width: 0; overflow-x: clip; }
        .section-header { display: grid; gap: 0.5rem; }
        .section-title { margin: 0; font-size: 2rem; letter-spacing: -0.05em; }
        .section-toolbar { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
        .section-copy { margin: 0; }
        .eyebrow { color: var(--text-muted); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
        .muted { color: var(--text-muted); }
        .compact-toggle {
          border: 1px solid var(--color-border);
          background: var(--bg-primary);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 0.55rem 0.82rem;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .compact-toggle-active {
          color: var(--accent-blue);
          border-color: rgba(59, 130, 246, 0.32);
          background: rgba(59, 130, 246, 0.08);
        }
        .casino-list { display: grid; gap: 0.9rem; min-width: 0; }
        .casino-list > :nth-child(odd) { background: rgba(17, 24, 39, 0.38); }
        .casino-list > :nth-child(even) { background: rgba(17, 24, 39, 0.52); }
        .empty-state { display: grid; gap: 0.45rem; justify-items: start; padding: 1rem 0.25rem 0.25rem; }
        .empty-state p { margin: 0; color: var(--text-secondary); }
        .empty-state a { color: var(--accent-blue); text-decoration: none; font-weight: 700; }
        .dashboard-loading { padding: 1rem 0.25rem 0.25rem; }
        .toast {
          position: sticky;
          top: 1rem;
          z-index: 15;
          justify-self: center;
          padding: 0.8rem 1rem;
          border-radius: 999px;
          font-weight: 700;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
        }
        .toast-success { background: rgba(16, 185, 129, 0.16); color: var(--accent-green); }
        .toast-error { background: rgba(239, 68, 68, 0.16); color: var(--accent-red); }
        .discovery-expand-tab {
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          writing-mode: vertical-rl;
          background: var(--bg-secondary);
          border: 1px solid var(--color-border);
          border-right: none;
          border-radius: 8px 0 0 8px;
          padding: 0.75rem 0.4rem;
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          z-index: 10;
        }
        @media (max-width: 1024px) {
          .dashboard-main,
          .dashboard-main-sidebar,
          .dashboard-main-stacked { grid-template-columns: 1fr; }
          .dashboard-main-swapped .dashboard-column-primary,
          .dashboard-main-swapped .dashboard-column-secondary { order: initial; }
          .discovery-expand-tab { display: none; }
        }
        @media (max-width: 640px) {
          .dashboard-section { padding: 1rem; }
          .section-toolbar { align-items: stretch; }
          .compact-toggle { width: 100%; }
        }
      `}</style>
    </div>
  );
}

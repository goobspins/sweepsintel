import { useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';

import type { SessionUser } from '../../lib/auth';
import { computeNextReset } from '../../lib/reset';
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
  scEarnedToday: number;
  usdEarnedToday: number;
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

const MODE_META: Record<ActionMode, { label: string; saveLabel: string; accent: string; endpoint: string }> = {
  daily: { label: 'Daily', saveLabel: 'Save', accent: 'var(--accent-green)', endpoint: '/api/tracker/claim' },
  adjust: { label: 'Adjust', saveLabel: 'Save Adj', accent: 'var(--accent-yellow)', endpoint: '/api/ledger/entry' },
  spins: { label: 'Spins', saveLabel: 'Save Spins', accent: 'var(--accent-blue)', endpoint: '/api/tracker/free-sc' },
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
  const [purchaseOpenByCasino, setPurchaseOpenByCasino] = useState<Record<number, boolean>>({});
  const [purchaseDraftByCasino, setPurchaseDraftByCasino] = useState<Record<number, PurchaseDraft>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [momentumCollapsed, setMomentumCollapsed] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem('dashboard:momentum-collapsed');
    if (saved === 'true') setMomentumCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('dashboard:momentum-collapsed', momentumCollapsed ? 'true' : 'false');
  }, [momentumCollapsed]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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
  const overGoalUsd = Math.max(0, summary.usdEarnedToday - dailyGoalUsd);
  const progressPct = dailyGoalUsd > 0 ? Math.min(100, (summary.usdEarnedToday / dailyGoalUsd) * 100) : 0;
  const spotlightCasino = discovery.casinos[0] ?? null;
  const compactDiscovery = discovery.casinos.slice(1);

  function getMode(casinoId: number): ActionMode {
    return modeByCasino[casinoId] ?? 'daily';
  }

  function getPurchaseDraft(casinoId: number) {
    return purchaseDraftByCasino[casinoId] ?? DEFAULT_PURCHASE_DRAFT;
  }

  async function refreshTracker() {
    const response = await fetch('/api/tracker/status');
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error ?? 'Unable to refresh dashboard.');
    setCasinos(data.casinos ?? []);
    setStreakClaims(data.streakClaims ?? []);
  }

  async function handleSave(casino: CasinoRowModel) {
    const mode = getMode(casino.casinoId);
    const rawAmount = amountByCasino[casino.casinoId] ?? '';
    const scAmount = rawAmount.trim() === '' ? null : Number(rawAmount);
    const note = (noteByCasino[casino.casinoId] ?? '').trim();
    const saveKey = `${mode}:${casino.casinoId}`;

    if (scAmount !== null && (!Number.isFinite(scAmount) || scAmount < 0)) {
      setToast({ tone: 'error', message: 'Enter a valid SC amount.' });
      return;
    }
    if (mode !== 'daily' && scAmount === null) {
      setToast({ tone: 'error', message: 'SC amount is required.' });
      return;
    }

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
      setToast({ tone: 'success', message: mode === 'daily' ? `${casino.name} saved.` : mode === 'adjust' ? `${casino.name} adjustment saved.` : `${casino.name} spins saved.` });
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
      <section className="surface-card momentum-card">
        <button type="button" className="momentum-toggle" onClick={() => setMomentumCollapsed((current) => !current)}>
          <div className="momentum-head">
            <div>
              <div className="eyebrow">Momentum</div>
              <h1 className="section-title momentum-title">Daily target</h1>
            </div>
            <div className="momentum-summary">
              <span>${summary.usdEarnedToday.toFixed(2)} / ${dailyGoalUsd.toFixed(2)}</span>
              <span className="collapse-indicator">{momentumCollapsed ? 'Expand' : 'Collapse'}</span>
            </div>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="momentum-foot">
            <span className="muted">{summary.scEarnedToday.toFixed(2)} SC captured today</span>
            {overGoalUsd > 0 ? <span className="over-goal">+${overGoalUsd.toFixed(2)} over goal</span> : <span className="muted">${(dailyGoalUsd - summary.usdEarnedToday).toFixed(2)} to go</span>}
          </div>
        </button>
        {!momentumCollapsed ? (
          <div className="momentum-body">
            <div className="period-toggle" role="tablist" aria-label="Momentum period">
              <button type="button" className="period-button period-active">Daily</button>
              <button type="button" className="period-button" onClick={() => setToast({ tone: 'success', message: 'Weekly view coming soon.' })}>Weekly</button>
            </div>
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

      <section className="kpi-grid" aria-label="Dashboard KPIs">
        <article className="surface-card kpi-card"><span className="kpi-label">SC Earned Today</span><strong className="kpi-value kpi-positive">{summary.scEarnedToday.toFixed(2)}</strong></article>
        <article className="surface-card kpi-card"><span className="kpi-label">USD Earned Today</span><strong className="kpi-value kpi-positive">${summary.usdEarnedToday.toFixed(2)}</strong></article>
        <article className="surface-card kpi-card"><span className="kpi-label">Purchases</span><strong className="kpi-value">{summary.purchaseCountToday} <span className="kpi-subvalue">| ${summary.purchaseUsdToday.toFixed(2)}</span></strong></article>
        <article className="surface-card kpi-card"><span className="kpi-label">Pending Redemptions</span><strong className="kpi-value kpi-pending">{summary.pendingRedemptionsCount} <span className="kpi-subvalue">| ${summary.pendingRedemptionsUsd.toFixed(2)}</span></strong></article>
      </section>

      <section className="surface-card dashboard-section">
        <div className="section-header">
          <div>
            <div className="eyebrow">Heartbeat</div>
            <h2 className="section-title">Dashboard</h2>
            <p className="muted section-copy">{casinoRows.length} tracked casinos. Available rows float to the top.</p>
          </div>
        </div>
        {casinoRows.length === 0 ? (
          <div className="empty-state"><p>No casinos are being tracked yet.</p><a href="/casinos">Browse casinos</a></div>
        ) : (
          <div className="casino-list">
            {casinoRows.map((casino) => {
              const mode = getMode(casino.casinoId);
              const meta = MODE_META[mode];
              const purchaseOpen = purchaseOpenByCasino[casino.casinoId] ?? false;
              const purchaseDraft = getPurchaseDraft(casino.casinoId);
              const actionPending = pendingKey === `${mode}:${casino.casinoId}`;
              const purchasePending = pendingKey === `purchase:${casino.casinoId}`;

              return (
                <article key={casino.casinoId} id={`casino-${casino.casinoId}`} className="casino-row">
                  <div className="casino-main">
                    <div className="casino-copy">
                      <div className="casino-heading">
                        <a href={`/casinos/${casino.slug}`} className="casino-link">{casino.name}</a>
                        {casino.tier ? (
                          <span className="tier-badge" style={getTierBadgeStyle(casino.tier)}>{casino.tier}</span>
                        ) : null}
                      </div>
                      <div className="casino-meta">
                        {casino.noDailyReward ? <span className="muted">No daily reward</span> : <ResetLine casino={casino} userTimezone={user.timezone} nowTs={nowTs} />}
                        {casino.lastClaimedAt ? <span className="muted">Last {formatLastClaim(casino.lastClaimedAt, user.timezone)}</span> : null}
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
                        <input inputMode="decimal" placeholder="SC amount" value={amountByCasino[casino.casinoId] ?? ''} onChange={(event) => setAmountByCasino((current) => ({ ...current, [casino.casinoId]: event.target.value }))} disabled={actionPending || (mode === 'daily' && casino.status !== 'available')} />
                        {mode !== 'daily' ? <input placeholder="Description" value={noteByCasino[casino.casinoId] ?? ''} onChange={(event) => setNoteByCasino((current) => ({ ...current, [casino.casinoId]: event.target.value }))} disabled={actionPending} /> : null}
                        <button type="button" className="save-button" style={{ background: meta.accent }} onClick={() => void handleSave(casino)} disabled={actionPending || (mode === 'daily' && casino.status !== 'available')}>{actionPending ? 'Saving...' : meta.saveLabel}</button>
                      </div>
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
        <section className="surface-card discovery-section">
          <div className="section-header">
            <div>
              <div className="eyebrow">Discovery</div>
              <h2 className="section-title">Casinos you're missing</h2>
              <p className="muted section-copy">
                {discovery.homeState ? `Personalized for ${discovery.homeState}. ` : ''}
                Ranked from the strongest untracked opportunities already in your orbit.
              </p>
            </div>
          </div>

          <div className="discovery-spotlight">
            <div className="spotlight-copy">
              <div className="spotlight-topline">
                <div className="spotlight-heading">
                  <span className="spotlight-label">Spotlight</span>
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
              <a href={`/casinos/${spotlightCasino.slug}`} className="spotlight-secondary">Full profile</a>
              <a
                href={spotlightCasino.has_affiliate_link && spotlightCasino.affiliate_link_url ? spotlightCasino.affiliate_link_url : `/casinos/${spotlightCasino.slug}`}
                className="spotlight-primary"
                target={spotlightCasino.has_affiliate_link && spotlightCasino.affiliate_link_url ? '_blank' : undefined}
                rel={spotlightCasino.has_affiliate_link && spotlightCasino.affiliate_link_url ? 'noopener noreferrer' : undefined}
              >
                {spotlightCasino.has_affiliate_link && spotlightCasino.affiliate_link_url ? 'Sign up' : 'Learn more'}
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
                        <span className="health-dot" style={getDiscoveryHealthStyle(casino.promoban_risk)} />
                        <span>{getDiscoveryLead(casino)}</span>
                      </div>
                    </div>
                    {casino.tier ? (
                      <span className="tier-badge" style={getTierBadgeStyle(casino.tier)}>{casino.tier}</span>
                    ) : null}
                  </div>
                  <p className="discovery-card-copy">{buildCompactPitch(casino)}</p>
                  <div className="discovery-card-actions">
                    <a href={`/casinos/${casino.slug}`} className="discovery-link">Learn more</a>
                    <a
                      href={casino.has_affiliate_link && casino.affiliate_link_url ? casino.affiliate_link_url : `/casinos/${casino.slug}`}
                      className="discovery-link discovery-link-primary"
                      target={casino.has_affiliate_link && casino.affiliate_link_url ? '_blank' : undefined}
                      rel={casino.has_affiliate_link && casino.affiliate_link_url ? 'noopener noreferrer' : undefined}
                    >
                      {casino.has_affiliate_link && casino.affiliate_link_url ? 'Sign up' : 'Open'}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <style>{`
        .dashboard-shell { display: grid; gap: 1.25rem; }
        .momentum-card, .dashboard-section, .discovery-section { padding: 1.2rem; }
        .momentum-toggle { display: grid; gap: 0.9rem; width: 100%; border: none; background: transparent; color: inherit; padding: 0; text-align: left; cursor: pointer; }
        .momentum-head, .section-header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
        .eyebrow { color: var(--text-muted); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
        .momentum-title { margin: 0.15rem 0 0; font-size: 1.55rem; }
        .momentum-summary { display: grid; gap: 0.2rem; justify-items: end; font-weight: 700; }
        .collapse-indicator { color: var(--text-muted); font-size: 0.9rem; }
        .progress-track { height: 16px; border-radius: 999px; background: var(--bg-primary); border: 1px solid var(--color-border); overflow: hidden; }
        .progress-fill { height: 100%; border-radius: inherit; background: var(--progress-gradient); transition: width 180ms ease; }
        .momentum-foot { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; font-size: 0.95rem; }
        .over-goal { color: var(--accent-green); font-weight: 700; }
        .momentum-body { margin-top: 1rem; border-top: 1px solid var(--color-border); padding-top: 1rem; display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: center; }
        .period-toggle { display: inline-flex; gap: 0.5rem; padding: 0.35rem; border-radius: 999px; background: var(--bg-primary); border: 1px solid var(--color-border); }
        .period-button { border: none; background: transparent; color: var(--text-secondary); border-radius: 999px; padding: 0.55rem 0.9rem; cursor: pointer; font-weight: 700; }
        .period-active { background: rgba(59, 130, 246, 0.16); color: var(--text-primary); }
        .momentum-inline-kpis { display: flex; gap: 0.65rem; flex-wrap: wrap; justify-content: flex-end; }
        .momentum-chip { display: grid; gap: 0.15rem; min-width: 110px; padding: 0.7rem 0.85rem; border-radius: 1rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.48); }
        .momentum-chip-label { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .kpi-grid { display: grid; gap: 1rem; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .kpi-card { padding: 1rem 1.1rem; display: grid; gap: 0.45rem; min-height: 112px; }
        .kpi-label { color: var(--text-muted); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .kpi-value { color: var(--text-primary); font-size: clamp(1.55rem, 4vw, 2rem); letter-spacing: -0.04em; }
        .kpi-positive { color: var(--accent-green); }
        .kpi-pending { color: var(--accent-yellow); }
        .kpi-subvalue { color: var(--text-secondary); font-size: 1rem; font-weight: 600; }
        .section-copy { margin: 0; }
        .casino-list { display: grid; gap: 0.85rem; }
        .casino-row { display: grid; gap: 0.9rem; padding: 1rem; border-radius: 1.2rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.52); scroll-margin-top: 7rem; }
        .casino-row:target { border-color: rgba(59, 130, 246, 0.52); box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.18), 0 18px 40px rgba(2, 6, 23, 0.38); }
        .casino-main { display: flex; gap: 1rem; justify-content: space-between; align-items: center; }
        .casino-copy { display: grid; gap: 0.45rem; min-width: 0; }
        .casino-heading { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; }
        .casino-link { color: var(--text-primary); text-decoration: none; font-size: 1.08rem; font-weight: 800; letter-spacing: -0.03em; }
        .tier-badge { display: inline-flex; min-width: 2rem; justify-content: center; border-radius: 999px; padding: 0.25rem 0.55rem; font-size: 0.78rem; font-weight: 800; border: 1px solid transparent; }
        .casino-meta { display: flex; gap: 0.85rem; flex-wrap: wrap; align-items: center; font-size: 0.92rem; }
        .action-stack { display: grid; gap: 0.7rem; width: min(100%, 560px); justify-items: end; }
        .mode-toggle, .entry-row, .purchase-actions { display: flex; gap: 0.55rem; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
        .mode-pill, .buy-button, .save-button, .ghost-button, .purchase-save { border-radius: 999px; font-weight: 700; cursor: pointer; }
        .mode-pill, .buy-button, .ghost-button { border: 1px solid var(--color-border); background: var(--bg-primary); color: var(--text-secondary); padding: 0.58rem 0.82rem; }
        .buy-button-open { color: var(--accent-blue); border-color: var(--accent-blue); }
        .entry-row input, .purchase-grid input { border-radius: 0.85rem; border: 1px solid var(--color-border); background: var(--bg-primary); color: var(--text-primary); padding: 0.72rem 0.82rem; min-width: 0; }
        .entry-row input { min-width: 140px; flex: 1 1 140px; }
        .save-button, .purchase-save { border: none; color: #0b1220; padding: 0.74rem 1rem; }
        .save-button:disabled, .purchase-save:disabled, .mode-pill:disabled, .buy-button:disabled, .ghost-button:disabled { cursor: not-allowed; opacity: 0.65; }
        .purchase-panel { display: grid; gap: 0.75rem; padding-top: 0.9rem; border-top: 1px solid var(--color-border); }
        .purchase-grid { display: grid; gap: 0.7rem; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .ghost-button { color: var(--text-primary); }
        .purchase-save { background: var(--accent-blue); }
        .empty-state { display: grid; gap: 0.45rem; justify-items: start; padding: 1rem 0.25rem 0.25rem; }
        .empty-state p { margin: 0; color: var(--text-secondary); }
        .discovery-section { display: grid; gap: 1rem; }
        .discovery-spotlight { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1.6fr) auto; padding: 1.15rem; border-radius: 1.35rem; border: 1px solid rgba(59, 130, 246, 0.24); background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(17, 24, 39, 0.58)); }
        .spotlight-copy { display: grid; gap: 0.9rem; }
        .spotlight-topline { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
        .spotlight-heading { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; }
        .spotlight-label { display: inline-flex; padding: 0.28rem 0.55rem; border-radius: 999px; background: rgba(59, 130, 246, 0.14); color: var(--accent-blue); font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
        .spotlight-title { color: var(--text-primary); text-decoration: none; font-size: 1.45rem; font-weight: 800; letter-spacing: -0.04em; }
        .health-pill { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.32rem 0.6rem; border-radius: 999px; border: 1px solid currentColor; font-size: 0.8rem; font-weight: 700; }
        .spotlight-pitch, .discovery-card-copy { margin: 0; color: var(--text-secondary); line-height: 1.65; }
        .spotlight-facts { display: grid; gap: 0.75rem; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .spotlight-fact { display: grid; gap: 0.28rem; padding: 0.85rem; border-radius: 1rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.48); }
        .spotlight-fact-label { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .spotlight-actions { display: grid; gap: 0.65rem; align-content: end; }
        .spotlight-primary, .spotlight-secondary, .discovery-link { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0.78rem 1rem; text-decoration: none; font-weight: 700; white-space: nowrap; }
        .spotlight-primary, .discovery-link-primary { background: var(--accent-blue); color: var(--text-primary); }
        .spotlight-secondary, .discovery-link { border: 1px solid var(--color-border); color: var(--text-primary); background: rgba(17, 24, 39, 0.42); }
        .discovery-grid { display: grid; gap: 0.9rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .discovery-card { display: grid; gap: 0.85rem; padding: 1rem; border-radius: 1.2rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.46); }
        .discovery-card-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; }
        .discovery-card-title { color: var(--text-primary); text-decoration: none; font-size: 1rem; font-weight: 800; letter-spacing: -0.03em; }
        .discovery-card-meta { display: flex; align-items: center; gap: 0.45rem; color: var(--text-muted); font-size: 0.86rem; margin-top: 0.3rem; }
        .health-dot { width: 0.6rem; height: 0.6rem; border-radius: 999px; display: inline-block; border: 1px solid currentColor; }
        .discovery-card-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
        .toast { position: sticky; top: 1rem; z-index: 15; justify-self: center; padding: 0.8rem 1rem; border-radius: 999px; font-weight: 700; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3); }
        .toast-success { background: rgba(16, 185, 129, 0.16); color: var(--accent-green); }
        .toast-error { background: rgba(239, 68, 68, 0.16); color: var(--accent-red); }
        @media (max-width: 1180px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .purchase-grid, .spotlight-facts, .discovery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .discovery-spotlight { grid-template-columns: 1fr; } .spotlight-actions { grid-auto-flow: column; justify-content: flex-start; } }
        @media (max-width: 780px) { .casino-main { flex-direction: column; align-items: stretch; } .action-stack { width: 100%; justify-items: stretch; } .mode-toggle, .entry-row, .purchase-actions { justify-content: flex-start; } .momentum-body { align-items: stretch; } .momentum-inline-kpis { justify-content: flex-start; } }
        @media (max-width: 640px) { .kpi-grid, .purchase-grid, .spotlight-facts, .discovery-grid { grid-template-columns: 1fr; } .momentum-summary { justify-items: start; } .entry-row input, .purchase-grid input, .save-button, .purchase-save, .ghost-button, .spotlight-primary, .spotlight-secondary, .discovery-link { width: 100%; } .spotlight-actions, .discovery-card-actions { grid-auto-flow: row; display: grid; } }
      `}</style>
    </div>
  );
}

function ResetLine({ casino, userTimezone, nowTs }: { casino: CasinoRowModel; userTimezone: string; nowTs: number }) {
  const summary = computeNextReset(
    {
      reset_mode: casino.resetMode,
      reset_time_local: casino.resetTimeLocal,
      reset_timezone: casino.resetTimezone,
      reset_interval_hours: casino.resetIntervalHours,
      last_claimed_at: casino.lastClaimedAt,
    },
    userTimezone,
  );

  let text = summary?.label ?? 'Reset time unknown';
  let color = 'var(--text-muted)';

  if (casino.status === 'available') {
    text = 'Available now';
    color = 'var(--accent-green)';
  } else if (casino.status === 'claimed' && summary?.nextResetAt) {
    const next = DateTime.fromISO(summary.nextResetAt).setZone(userTimezone);
    if (next.isValid) {
      const minutes = Math.max(0, Math.ceil(next.diff(DateTime.fromMillis(nowTs), 'minutes').minutes));
      const hours = Math.floor(minutes / 60);
      const remainder = minutes % 60;
      text = `Next in ${hours}h ${remainder}m`;
    }
  } else if (casino.status === 'countdown' && summary) {
    text = `Next in ${summary.label}`;
  }

  return <span style={{ color, fontWeight: 700 }}>{text}</span>;
}

function buildCasinoRowModel(casino: TrackerCasinoRow, claims: string[], nowTs: number): CasinoRowModel {
  const todayClaimedAt = casino.today_claimed_at;
  const lastClaimedAt = todayClaimedAt ?? claims[0] ?? null;
  const status = casino.no_daily_reward ? 'no-daily' : todayClaimedAt ? 'claimed' : isAvailableNow(casino, lastClaimedAt, nowTs) ? 'available' : 'countdown';
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

function isAvailableNow(casino: TrackerCasinoRow, lastClaimedAt: string | null, nowTs: number) {
  const now = DateTime.fromMillis(nowTs);
  if (casino.reset_mode === 'fixed') {
    if (!casino.reset_time_local || !casino.reset_timezone) return false;
    const [hour, minute] = casino.reset_time_local.split(':').map(Number);
    const reset = now.setZone(casino.reset_timezone).set({ hour, minute, second: 0, millisecond: 0 });
    return now.setZone(casino.reset_timezone) >= reset;
  }
  if (!lastClaimedAt) return true;
  return DateTime.fromISO(lastClaimedAt).plus({ hours: casino.reset_interval_hours ?? 24 }) <= now;
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
  if (casino.resetMode === 'fixed' && casino.resetTimeLocal && casino.resetTimezone) {
    const [hour, minute] = casino.resetTimeLocal.split(':').map(Number);
    const now = DateTime.now().setZone(casino.resetTimezone);
    let next = now.set({ hour, minute, second: 0, millisecond: 0 });
    if (now >= next) next = next.plus({ days: 1 });
    return next.setZone(userTimezone).toMillis();
  }
  if (casino.lastClaimedAt) {
    return DateTime.fromISO(casino.lastClaimedAt).plus({ hours: casino.resetIntervalHours ?? 24 }).toMillis();
  }
  return 0;
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
  return dt.isValid ? dt.toFormat("MMM d, h:mm a") : 'claimed recently';
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

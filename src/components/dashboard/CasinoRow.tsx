import HealthDot from '../health/HealthDot';
import type { ActionMode, CasinoRowModel, PurchaseDraft } from './types';
import { MODE_META, getTierBadgeStyle } from './utils';

interface CasinoRowProps {
  casino: CasinoRowModel;
  mode: ActionMode;
  meta: { label: string; saveLabel: string; accent: string };
  amount: string;
  note: string;
  inputError: string;
  purchaseOpen: boolean;
  purchaseDraft: PurchaseDraft;
  actionPending: boolean;
  purchasePending: boolean;
  compactMode: boolean;
  statusDisplay: {
    isDue: boolean;
    primary: string;
    primaryClassName: string;
    secondary: string | null;
    secondaryClassName: string;
  };
  onModeChange: (casinoId: number, mode: ActionMode) => void;
  onAmountChange: (casinoId: number, value: string) => void;
  onNoteChange: (casinoId: number, value: string) => void;
  onSave: (casino: CasinoRowModel) => void;
  onPurchaseToggle: (casinoId: number) => void;
  onPurchaseDraftChange: (casinoId: number, patch: Partial<PurchaseDraft>) => void;
  onPurchaseSave: (casino: CasinoRowModel) => void;
}

export default function CasinoRow({
  casino,
  mode,
  meta,
  amount,
  note,
  inputError,
  purchaseOpen,
  purchaseDraft,
  actionPending,
  purchasePending,
  compactMode,
  statusDisplay,
  onModeChange,
  onAmountChange,
  onNoteChange,
  onSave,
  onPurchaseToggle,
  onPurchaseDraftChange,
  onPurchaseSave,
}: CasinoRowProps) {
  const infoTooltip = [
    `Health: ${formatTooltipValue(casino.healthStatus)}`,
    `Tier: ${formatTooltipValue(casino.tier)}`,
    `PB risk: ${formatTooltipValue(casino.promobanRisk)}`,
    `Redeem speed: ${formatTooltipValue(casino.redemptionSpeedDesc)}`,
    `Daily bonus: ${formatTooltipValue(casino.dailyBonusDesc)}`,
  ].join('\n');

  return (
    <article key={casino.casinoId} id={`casino-${casino.casinoId}`} className={`casino-row ${statusDisplay.isDue ? 'casino-row-due' : ''} ${compactMode ? 'casino-row-compact' : ''}`}>
      <div className="casino-main">
        <div className="casino-copy">
          <div className="casino-heading">
            <HealthDot status={casino.healthStatus} size={10} pulse={casino.healthStatus === 'critical'} />
            <a href={`/casinos/${casino.slug}`} className="casino-link">{casino.name}</a>
            {casino.tier ? (
              <span className="tier-badge" style={getTierBadgeStyle(casino.tier)}>{casino.tier}</span>
            ) : null}
            <span className="casino-info-chip" title={infoTooltip} aria-label={infoTooltip}>i</span>
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
                onClick={() => onModeChange(casino.casinoId, modeOption)}
              >
                {MODE_META[modeOption].label}
              </button>
            ))}
            <button type="button" className={`buy-button ${purchaseOpen ? 'buy-button-open' : ''}`} onClick={() => onPurchaseToggle(casino.casinoId)}>+ Buy</button>
          </div>
          <div className="entry-row">
            <input
              type="number"
              inputMode="decimal"
              min={mode === 'adjust' ? undefined : 0}
              placeholder="SC amount"
              value={amount}
              onChange={(event) => onAmountChange(casino.casinoId, event.target.value)}
              disabled={actionPending || (mode === 'daily' && casino.status !== 'available')}
            />
            {mode !== 'daily' ? <input placeholder="Description" value={note} onChange={(event) => onNoteChange(casino.casinoId, event.target.value)} disabled={actionPending} /> : null}
            <button type="button" className="save-button" style={{ background: meta.accent }} onClick={() => onSave(casino)} disabled={actionPending || (mode === 'daily' && casino.status !== 'available')}>{actionPending ? 'Saving...' : meta.saveLabel}</button>
          </div>
          {inputError ? <div className="entry-error">{inputError}</div> : null}
        </div>
      </div>
      {purchaseOpen ? (
        <div className="purchase-panel">
          <div className="purchase-grid">
            <input inputMode="decimal" placeholder="Cost USD" value={purchaseDraft.costUsd} onChange={(event) => onPurchaseDraftChange(casino.casinoId, { costUsd: event.target.value })} disabled={purchasePending} />
            <input inputMode="decimal" placeholder="SC received" value={purchaseDraft.scAmount} onChange={(event) => onPurchaseDraftChange(casino.casinoId, { scAmount: event.target.value })} disabled={purchasePending} />
            <input placeholder="Promo code" value={purchaseDraft.promoCode} onChange={(event) => onPurchaseDraftChange(casino.casinoId, { promoCode: event.target.value })} disabled={purchasePending} />
            <input placeholder="Notes" value={purchaseDraft.notes} onChange={(event) => onPurchaseDraftChange(casino.casinoId, { notes: event.target.value })} disabled={purchasePending} />
          </div>
          <div className="purchase-actions">
            <button type="button" className="ghost-button" onClick={() => onPurchaseToggle(casino.casinoId)} disabled={purchasePending}>Cancel</button>
            <button type="button" className="purchase-save" onClick={() => onPurchaseSave(casino)} disabled={purchasePending}>{purchasePending ? 'Saving...' : 'Save Purchase'}</button>
          </div>
        </div>
      ) : null}
      <style>{`
        .casino-row { display: grid; gap: 0.9rem; padding: 1rem; border-radius: 1.2rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.52); scroll-margin-top: 7rem; }
        .casino-row-due { border-left: 3px solid var(--accent-green); }
        .casino-main { display: flex; gap: 1rem; justify-content: space-between; align-items: center; min-width: 0; }
        .casino-copy { display: grid; gap: 0.45rem; min-width: 0; }
        .casino-heading { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; }
        .casino-link { color: var(--text-primary); text-decoration: none; font-size: 1.08rem; font-weight: 800; letter-spacing: -0.03em; }
        .tier-badge { display: inline-flex; min-width: 2rem; justify-content: center; border-radius: 999px; padding: 0.25rem 0.55rem; font-size: 0.78rem; font-weight: 800; border: 1px solid transparent; }
        .casino-info-chip { display: inline-flex; align-items: center; justify-content: center; width: 1.2rem; height: 1.2rem; border-radius: 999px; border: 1px solid var(--color-border); color: var(--text-muted); font-size: 0.72rem; font-weight: 800; cursor: help; background: rgba(17, 24, 39, 0.55); }
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
        .muted { color: var(--text-muted); }
        .casino-row-compact { padding: 0.6rem; }
        .casino-row-compact .casino-link { font-size: 0.95rem; }
        .casino-row-compact .mode-pill,
        .casino-row-compact .buy-button,
        .casino-row-compact .save-button,
        .casino-row-compact .ghost-button,
        .casino-row-compact .purchase-save { padding: 0.55rem 0.8rem; font-size: 0.88rem; }
        .casino-row-compact .status-secondary,
        .casino-row-compact .status-secondary-amber { display: none; }
        @media (max-width: 1180px) { .purchase-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 780px) {
          .casino-main { flex-direction: column; align-items: stretch; }
          .action-stack { width: 100%; justify-items: stretch; }
          .mode-toggle, .entry-row, .purchase-actions { justify-content: flex-start; }
        }
        @media (max-width: 640px) {
          .purchase-grid { grid-template-columns: 1fr; }
          .entry-row input, .purchase-grid input, .save-button, .purchase-save, .ghost-button { width: 100%; }
        }
      `}</style>
    </article>
  );
}

function formatTooltipValue(value: string | null) {
  return value && value.trim() ? value.trim() : 'Unknown';
}


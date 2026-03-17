import { MOMENTUM_GRADIENTS } from './utils';
import type { DashboardSummary } from './types';

interface MomentumStripProps {
  summary: DashboardSummary;
  momentumPeriod: 'daily' | 'weekly';
  onPeriodChange: (period: 'daily' | 'weekly') => void;
  goalEditing: boolean;
  goalDraft: string;
  goalSaving: boolean;
  momentumCollapsed: boolean;
  onToggleCollapsed: () => void;
  onGoalDraftChange: (value: string) => void;
  onGoalEditStart: () => void;
  onGoalEditCancel: () => void;
  onGoalCommit: () => void;
}

export default function MomentumStrip({
  summary,
  momentumPeriod,
  onPeriodChange,
  goalEditing,
  goalDraft,
  goalSaving,
  momentumCollapsed,
  onToggleCollapsed,
  onGoalDraftChange,
  onGoalEditStart,
  onGoalEditCancel,
  onGoalCommit,
}: MomentumStripProps) {
  const dailyGoalUsd = summary.dailyGoalUsd || 5;
  const weeklyGoalUsd = summary.weeklyGoalUsd;
  const isWeekly = momentumPeriod === 'weekly' && weeklyGoalUsd !== null;
  const activeUsdEarned = isWeekly ? summary.usdEarnedWeek : summary.usdEarnedToday;
  const activeScEarned = isWeekly ? summary.scEarnedWeek : summary.scEarnedToday;
  const activeGoalUsd = isWeekly ? weeklyGoalUsd ?? dailyGoalUsd : dailyGoalUsd;
  const overGoalUsd = Math.max(0, activeUsdEarned - activeGoalUsd);
  const progressPct = activeGoalUsd > 0 ? Math.min(100, (activeUsdEarned / activeGoalUsd) * 100) : 0;
  const progressLabel = `${Math.round(progressPct)}%`;
  const momentumFillStyle = {
    width: `${progressPct}%`,
    background: MOMENTUM_GRADIENTS[summary.momentumStyle] ?? MOMENTUM_GRADIENTS.rainbow,
  };

  return (
    <section className={`surface-card momentum-card ${momentumCollapsed ? 'momentum-card-collapsed' : ''}`}>
      <div
        className="momentum-toggle"
        role="button"
        tabIndex={0}
        onClick={onToggleCollapsed}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggleCollapsed();
          }
        }}
      >
        <div className="momentum-strip">
          <div className="period-toggle" role="tablist" aria-label="Momentum period" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={`period-button ${momentumPeriod === 'daily' ? 'period-active' : ''}`}
              onClick={() => onPeriodChange('daily')}
            >
              Daily
            </button>
            <button
              type="button"
              className={`period-button ${momentumPeriod === 'weekly' ? 'period-active' : ''}`}
              onClick={() => onPeriodChange('weekly')}
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
                  onChange={(event) => onGoalDraftChange(event.target.value)}
                  onBlur={() => void onGoalCommit()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter') {
                      void onGoalCommit();
                    } else if (event.key === 'Escape') {
                      onGoalEditCancel();
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
                    if (!isWeekly) {
                      onGoalEditStart();
                    }
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
      <style>{`
        .momentum-card { padding: 1.2rem; padding-block: 0.85rem; }
        .momentum-card-collapsed { min-height: 48px; }
        .momentum-toggle { display: grid; gap: 0.9rem; width: 100%; background: transparent; color: inherit; padding: 0; text-align: left; cursor: pointer; }
        .momentum-strip { display: grid; gap: 0.8rem; grid-template-columns: auto auto minmax(220px, 1fr) auto; align-items: center; }
        .period-toggle { display: inline-flex; gap: 0.5rem; padding: 0.35rem; border-radius: 999px; background: var(--bg-primary); border: 1px solid var(--color-border); }
        .period-button { border: none; background: transparent; color: var(--text-secondary); border-radius: 999px; padding: 0.55rem 0.9rem; cursor: pointer; font-weight: 700; }
        .period-button:disabled { opacity: 0.5; cursor: not-allowed; }
        .period-active { background: rgba(59, 130, 246, 0.16); color: var(--text-primary); }
        .momentum-inline-copy { display: flex; gap: 0.8rem; flex-wrap: wrap; align-items: center; }
        .momentum-captured { color: var(--text-primary); font-weight: 700; }
        .momentum-remaining { color: var(--accent-yellow); font-weight: 700; }
        .over-goal { color: var(--accent-green); font-weight: 700; }
        .progress-row { display: flex; gap: 0.55rem; align-items: center; }
        .progress-track { position: relative; flex: 1 1 auto; height: 18px; border-radius: 999px; background: var(--bg-primary); border: 1px solid var(--color-border); overflow: hidden; }
        .progress-fill { height: 100%; border-radius: inherit; transition: width 180ms ease; }
        .progress-label { color: #fff; font-size: 0.85rem; font-weight: 800; letter-spacing: 0.02em; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35); }
        .progress-label-inline { position: absolute; inset: 0; display: grid; place-items: center; }
        .progress-label-side { color: var(--text-primary); min-width: 2.5rem; text-align: right; }
        .momentum-summary { display: grid; gap: 0.2rem; justify-items: end; font-weight: 700; }
        .goal-fraction { font-size: 1.05rem; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap; }
        .goal-edit-button { border: none; background: transparent; color: var(--text-primary); font: inherit; font-weight: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0; }
        .goal-edit-button:disabled { cursor: default; opacity: 0.92; }
        .goal-edit-hint { opacity: 0; color: var(--text-muted); font-size: 0.78rem; font-weight: 700; transition: opacity 140ms ease; }
        .goal-edit-button:hover .goal-edit-hint { opacity: 1; }
        .goal-input { width: 5rem; border-radius: 0.7rem; border: 1px solid var(--color-border); background: var(--bg-primary); color: var(--text-primary); padding: 0.35rem 0.5rem; font: inherit; font-weight: 800; }
        .collapse-indicator { color: var(--text-muted); font-size: 0.9rem; }
        .momentum-body { margin-top: 0.9rem; border-top: 1px solid var(--color-border); padding-top: 0.9rem; display: flex; justify-content: flex-end; gap: 1rem; flex-wrap: wrap; align-items: center; }
        .momentum-inline-kpis { display: flex; gap: 0.65rem; flex-wrap: wrap; justify-content: flex-end; }
        .momentum-chip { display: grid; gap: 0.15rem; min-width: 110px; padding: 0.7rem 0.85rem; border-radius: 1rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.48); }
        .momentum-chip-label { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        @media (max-width: 780px) {
          .momentum-strip { grid-template-columns: 1fr; }
          .momentum-body { align-items: stretch; }
          .momentum-summary { justify-items: start; }
          .momentum-inline-kpis { justify-content: flex-start; }
        }
      `}</style>
    </section>
  );
}


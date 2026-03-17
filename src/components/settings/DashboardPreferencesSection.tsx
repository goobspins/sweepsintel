import LedgerModeToggle from '../ledger/LedgerModeToggle';
import { KPI_OPTIONS, MOMENTUM_STYLE_OPTIONS } from './types';

interface DashboardPreferencesSectionProps {
  initialLedgerMode: 'simple' | 'advanced';
  ledgerMode: 'simple' | 'advanced';
  onLedgerModeChange: (mode: 'simple' | 'advanced') => void;
  kpiCards: string[];
  momentumStyle: string;
  onToggleKpiCard: (cardId: string) => void;
  onMomentumStyleChange: (value: string) => void;
}

export default function DashboardPreferencesSection({
  initialLedgerMode,
  ledgerMode,
  onLedgerModeChange,
  kpiCards,
  momentumStyle,
  onToggleKpiCard,
  onMomentumStyleChange,
}: DashboardPreferencesSectionProps) {
  return (
    <section className="surface-card settings-section">
      <div className="eyebrow">Dashboard</div>
      <h2 className="section-title section-heading">Dashboard Preferences</h2>
      <div className="field">
        <LedgerModeToggle initialMode={initialLedgerMode} mode={ledgerMode} saveUrl={null} onModeChange={onLedgerModeChange} />
      </div>
      <div className="field">
        <span>Dashboard KPI Cards</span>
        <div className="kpi-picker">
          {KPI_OPTIONS.map((option) => {
            const checked = kpiCards.includes(option.id);
            const disableUnchecked = !checked && kpiCards.length >= 4;
            return (
              <label key={option.id} className={`kpi-option ${checked ? 'kpi-option-active' : ''}`}>
                <input type="checkbox" checked={checked} disabled={disableUnchecked} onChange={() => onToggleKpiCard(option.id)} />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        <span className="field-hint">Choose 3 to 4 cards. Dashboard order follows your selection order.</span>
      </div>
      <div className="field">
        <span>Momentum Bar Style</span>
        <div className="swatch-row">
          {MOMENTUM_STYLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`swatch-button ${momentumStyle === option.id ? 'swatch-button-active' : ''}`}
              style={{ background: option.swatch }}
              aria-label={option.label}
              title={option.label}
              onClick={() => onMomentumStyleChange(option.id)}
            >
              {momentumStyle === option.id ? '✓' : ''}
            </button>
          ))}
        </div>
      </div>
      <style>{`
        .settings-section { display:grid; gap:1rem; padding:1.2rem; }
        .section-heading { margin:0; font-size:1.25rem; }
        .field { display:grid; gap:.45rem; }
        .field > span { font-weight:700; }
        .field-hint { color:var(--text-muted); font-size:.85rem; font-weight:600; }
        .kpi-picker { display:grid; gap:.65rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .kpi-option {
          display:flex; gap:.65rem; align-items:center; border:1px solid var(--color-border);
          border-radius:1rem; padding:.8rem .9rem; background:var(--color-surface); color:var(--text-secondary);
        }
        .kpi-option-active { color:var(--text-primary); border-color:rgba(59, 130, 246, 0.32); }
        .swatch-row { display:flex; gap:.65rem; flex-wrap:wrap; }
        .swatch-button {
          width:28px; height:28px; border-radius:999px; border:1px solid var(--color-border);
          color:#fff; font-weight:800; cursor:pointer; display:grid; place-items:center;
          box-shadow:0 0 0 0 transparent; transition:transform 120ms ease, box-shadow 120ms ease;
        }
        .swatch-button-active { transform:scale(1.06); box-shadow:0 0 0 2px rgba(255,255,255,.18); }
        @media (max-width: 720px) { .kpi-picker { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}

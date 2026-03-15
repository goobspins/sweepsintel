interface CasinoDetailPanelProps {
  casino: {
    promoban_risk: string;
    hardban_risk: string;
    family_ban_propagation: boolean;
    ban_confiscates_funds: boolean;
    sc_to_usd_ratio: number | string | null;
    redemption_speed_desc: string | null;
    min_redemption_usd: number | string | null;
    redemption_fee_desc: string | null;
    playthrough_multiplier: number | string | null;
    playthrough_notes: string | null;
    streak_mode: string | null;
    reset_time_local: string | null;
  };
  nextResetLabel?: string | null;
}

const badgeColors: Record<string, string> = {
  none: '#16A34A',
  low: '#16A34A',
  medium: '#D97706',
  high: '#DC2626',
  unknown: '#6B7280',
};

export default function CasinoDetailPanel({
  casino,
  nextResetLabel,
}: CasinoDetailPanelProps) {
  const rows = [
    ['Promoban Risk', badge(casino.promoban_risk)],
    ['Hardban Risk', badge(casino.hardban_risk)],
    [
      'Family Ban',
      casino.family_ban_propagation ? 'Yes - ban at one can mean ban at all' : 'No',
    ],
    [
      'Confiscates Funds',
      casino.ban_confiscates_funds
        ? 'Warning: funds can be confiscated on ban'
        : 'No',
    ],
    [
      'SC-to-USD Ratio',
      casino.sc_to_usd_ratio ? `${casino.sc_to_usd_ratio} ($1 per SC)` : 'Unknown',
    ],
    ['Redemption Speed', casino.redemption_speed_desc ?? 'Unknown'],
    [
      'Min Redemption',
      casino.min_redemption_usd ? `$${casino.min_redemption_usd}` : 'Unknown',
    ],
    ['Fees', casino.redemption_fee_desc ?? 'Unknown'],
    [
      'Playthrough',
      casino.playthrough_multiplier
        ? `${casino.playthrough_multiplier}x${casino.playthrough_notes ? ` - ${casino.playthrough_notes}` : ''}`
        : 'Unknown',
    ],
    [
      'Streak Mode',
      casino.streak_mode
        ? `${casino.streak_mode}${casino.reset_time_local ? ` @ ${casino.reset_time_local}` : ''}`
        : 'Unknown',
    ],
    ['Next Reset', nextResetLabel ?? 'Reset time unknown'],
  ];

  return (
    <div className="detail-panel">
      {rows.map(([label, value]) => (
        <div className="detail-row" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}

      <style>{`
        .detail-panel {
          display: grid;
          gap: 0.9rem;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .detail-row {
          display: grid;
          gap: 0.35rem;
          padding: 1rem;
          border: 1px solid var(--color-border);
          border-radius: 1.2rem;
          background: #fff;
        }

        .detail-row dt {
          font-weight: 700;
        }

        .detail-row dd {
          margin: 0;
          color: var(--color-muted);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}

function badge(value: string | null) {
  const normalized = value ?? 'unknown';
  const color = badgeColors[normalized] ?? '#6B7280';

  return (
    <span
      style={{
        display: 'inline-flex',
        width: 'fit-content',
        padding: '0.35rem 0.65rem',
        borderRadius: '999px',
        background: `${color}1A`,
        color,
        fontWeight: 700,
        textTransform: 'capitalize',
      }}
    >
      {normalized}
    </span>
  );
}

type StateRow = {
  state_code: string;
  state_name: string;
  sweepstakes_legal: boolean;
  legal_notes: string | null;
  casino_count: number | string;
  pullout_count: number | string;
};

interface StateMapProps {
  states: StateRow[];
}

const TILE_SIZE = 42;
const TILE_GAP = 6;

const TILE_MAP: Array<{ code: string; x: number; y: number }> = [
  { code: 'WA', x: 0, y: 0 }, { code: 'MT', x: 2, y: 0 }, { code: 'ND', x: 4, y: 0 }, { code: 'MN', x: 6, y: 0 }, { code: 'WI', x: 7, y: 0 }, { code: 'MI', x: 8, y: 0 }, { code: 'VT', x: 11, y: 0 }, { code: 'NH', x: 12, y: 0 }, { code: 'ME', x: 13, y: 0 },
  { code: 'OR', x: 0, y: 1 }, { code: 'ID', x: 1, y: 1 }, { code: 'WY', x: 2, y: 1 }, { code: 'SD', x: 4, y: 1 }, { code: 'IA', x: 6, y: 1 }, { code: 'IL', x: 7, y: 1 }, { code: 'IN', x: 8, y: 1 }, { code: 'OH', x: 9, y: 1 }, { code: 'PA', x: 10, y: 1 }, { code: 'NY', x: 11, y: 1 }, { code: 'MA', x: 12, y: 1 },
  { code: 'CA', x: 0, y: 2 }, { code: 'NV', x: 1, y: 2 }, { code: 'UT', x: 2, y: 2 }, { code: 'CO', x: 3, y: 2 }, { code: 'NE', x: 4, y: 2 }, { code: 'MO', x: 6, y: 2 }, { code: 'KY', x: 8, y: 2 }, { code: 'WV', x: 9, y: 2 }, { code: 'VA', x: 10, y: 2 }, { code: 'MD', x: 11, y: 2 }, { code: 'NJ', x: 12, y: 2 }, { code: 'CT', x: 13, y: 2 }, { code: 'RI', x: 14, y: 2 },
  { code: 'AZ', x: 1, y: 3 }, { code: 'NM', x: 2, y: 3 }, { code: 'KS', x: 4, y: 3 }, { code: 'AR', x: 6, y: 3 }, { code: 'TN', x: 8, y: 3 }, { code: 'NC', x: 10, y: 3 }, { code: 'SC', x: 11, y: 3 }, { code: 'DC', x: 12, y: 3 },
  { code: 'OK', x: 4, y: 4 }, { code: 'LA', x: 6, y: 4 }, { code: 'MS', x: 7, y: 4 }, { code: 'AL', x: 8, y: 4 }, { code: 'GA', x: 9, y: 4 },
  { code: 'TX', x: 4, y: 5 }, { code: 'FL', x: 10, y: 5 },
  { code: 'AK', x: 0, y: 6 }, { code: 'HI', x: 2, y: 6 },
  { code: 'DE', x: 13, y: 3 },
];

export default function StateMap({ states }: StateMapProps) {
  const stateMap = new Map(states.map((state) => [state.state_code, state]));

  return (
    <div className="state-map-shell">
      <div className="desktop-map">
        <svg
          viewBox={`0 0 ${(15 * (TILE_SIZE + TILE_GAP))} ${(8 * (TILE_SIZE + TILE_GAP))}`}
          role="img"
          aria-label="United States state availability map"
        >
          {TILE_MAP.map((tile) => {
            const state = stateMap.get(tile.code);
            if (!state) return null;

            const x = tile.x * (TILE_SIZE + TILE_GAP);
            const y = tile.y * (TILE_SIZE + TILE_GAP);
            const fill = getStateFill(state);

            return (
              <a key={tile.code} href={`/states/${tile.code.toLowerCase()}`}>
                <path
                  d={`M ${x} ${y} h ${TILE_SIZE} v ${TILE_SIZE} h -${TILE_SIZE} Z`}
                  fill={fill}
                  stroke="var(--text-primary)"
                  strokeWidth="2"
                >
                  <title>{`${state.state_name} - ${Number(state.casino_count)} casinos available`}</title>
                </path>
                <text
                  x={x + TILE_SIZE / 2}
                  y={y + TILE_SIZE / 2 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--text-primary)"
                >
                  {tile.code}
                </text>
              </a>
            );
          })}
        </svg>
      </div>

      <div className="mobile-list">
        {states.map((state) => (
          <a key={state.state_code} href={`/states/${state.state_code.toLowerCase()}`} className="state-row">
            <div>
              <strong>{state.state_name}</strong>
              <div className="muted">{Number(state.casino_count)} casinos available</div>
            </div>
            <span className={`status-pill ${getStateTone(state)}`}>{getStateLabel(state)}</span>
          </a>
        ))}
      </div>

      <style>{`
        .desktop-map { display:none; overflow:auto; }
        .desktop-map svg { width:100%; height:auto; border-radius:1rem; background:var(--bg-secondary); padding:1rem; }
        .mobile-list { display:grid; gap:.75rem; }
        .state-row {
          display:flex; justify-content:space-between; gap:.75rem; align-items:center;
          padding:1rem; border-radius:1rem; border:1px solid var(--color-border);
          background:var(--color-surface); text-decoration:none; color:var(--color-ink);
        }
        .status-pill {
          border-radius:999px; padding:.35rem .7rem; font-weight:700; white-space:nowrap;
        }
        .legal { background:rgba(16, 185, 129, 0.16); color:var(--accent-green); }
        .warning { background:rgba(245, 158, 11, 0.16); color:var(--accent-yellow); }
        .danger { background:rgba(239, 68, 68, 0.16); color:var(--accent-red); }
        @media (min-width: 768px) {
          .desktop-map { display:block; }
          .mobile-list { display:none; }
        }
      `}</style>
    </div>
  );
}

function getStateFill(state: StateRow) {
  if (!state.sweepstakes_legal) return 'rgba(239, 68, 68, 0.32)';
  if (Number(state.pullout_count) > 0) return 'rgba(245, 158, 11, 0.32)';
  return 'rgba(16, 185, 129, 0.28)';
}

function getStateTone(state: StateRow) {
  if (!state.sweepstakes_legal) return 'danger';
  if (Number(state.pullout_count) > 0) return 'warning';
  return 'legal';
}

function getStateLabel(state: StateRow) {
  if (!state.sweepstakes_legal) return 'Not Legal';
  if (Number(state.pullout_count) > 0) return 'Restricted';
  return 'Legal ✓';
}


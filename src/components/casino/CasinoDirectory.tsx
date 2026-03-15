import { useMemo, useState } from 'react';

import { compareCasinoTiers, getTierStyles, type CasinoTier } from '../../lib/casino-tier';
import CasinoCard from './CasinoCard';
import LiveGamesIndicator from './LiveGamesIndicator';

export interface DirectoryCasino {
  id: number;
  slug: string;
  name: string;
  tier: CasinoTier;
  promoban_risk: string;
  has_live_games: boolean;
  redemption_speed_desc: string | null;
  daily_bonus_desc: string | null;
  has_affiliate_link: boolean;
  affiliate_link_url: string | null;
  joined: boolean;
}

interface CasinoDirectoryProps {
  casinos: DirectoryCasino[];
}

const tierOptions: CasinoTier[] = ['S', 'A', 'B', 'C'];
const riskOptions = ['none', 'low', 'medium', 'high'];
const riskColors: Record<string, string> = {
  none: '#16A34A',
  low: '#16A34A',
  medium: '#D97706',
  high: '#DC2626',
  unknown: '#6B7280',
};

export default function CasinoDirectory({ casinos }: CasinoDirectoryProps) {
  const [activeTiers, setActiveTiers] = useState<CasinoTier[]>([]);
  const [activeRisks, setActiveRisks] = useState<string[]>([]);
  const [liveGamesOnly, setLiveGamesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'tier'>('tier');

  const filtered = useMemo(() => {
    const next = casinos.filter((casino) => {
      const tierMatch =
        activeTiers.length === 0 || activeTiers.includes(casino.tier);
      const riskMatch =
        activeRisks.length === 0 || activeRisks.includes(casino.promoban_risk);
      const liveMatch = !liveGamesOnly || casino.has_live_games;

      return tierMatch && riskMatch && liveMatch;
    });

    return next.sort((a, b) => {
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name);
      }

      return compareCasinoTiers(a.tier, b.tier) || a.name.localeCompare(b.name);
    });
  }, [activeRisks, activeTiers, casinos, liveGamesOnly, sortKey]);

  function toggleTier(tier: CasinoTier) {
    setActiveTiers((current) =>
      current.includes(tier)
        ? current.filter((value) => value !== tier)
        : [...current, tier],
    );
  }

  function toggleRisk(risk: string) {
    setActiveRisks((current) =>
      current.includes(risk)
        ? current.filter((value) => value !== risk)
        : [...current, risk],
    );
  }

  async function openAffiliate(
    event: React.MouseEvent<HTMLAnchorElement>,
    casino: DirectoryCasino,
  ) {
    if (!(casino.has_affiliate_link && !casino.joined && casino.affiliate_link_url)) {
      return;
    }

    event.preventDefault();

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3000);
      const response = await fetch('/api/affiliate/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: casino.id,
          referrer_source: 'directory',
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      const data = await response.json();
      window.open(
        data.url || casino.affiliate_link_url,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (error) {
      console.error(error);
      window.open(casino.affiliate_link_url, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <section className="directory-shell">
      <div className="filters">
        <div className="chip-group">
          {tierOptions.map((tier) => (
            <button
              key={tier}
              type="button"
              className={activeTiers.includes(tier) ? 'chip chip-active' : 'chip'}
              onClick={() => toggleTier(tier)}
            >
              Tier {tier}
            </button>
          ))}
        </div>
        <div className="chip-group">
          {riskOptions.map((risk) => (
            <button
              key={risk}
              type="button"
              className={activeRisks.includes(risk) ? 'chip chip-active' : 'chip'}
              onClick={() => toggleRisk(risk)}
            >
              {risk[0].toUpperCase() + risk.slice(1)} Risk
            </button>
          ))}
        </div>
        <button
          type="button"
          className={liveGamesOnly ? 'chip chip-active' : 'chip'}
          onClick={() => setLiveGamesOnly((current) => !current)}
        >
          Has Live Games
        </button>
      </div>

      <div className="table-toolbar">
        <label>
          Sort
          <select
            value={sortKey}
            onChange={(event) =>
              setSortKey(event.target.value as 'name' | 'tier')
            }
          >
            <option value="tier">Tier</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          No casinos match your filters. Try broadening your search.
        </div>
      ) : (
        <>
          <div className="mobile-list">
            {filtered.map((casino) => (
              <CasinoCard
                key={casino.id}
                casino={casino}
                destination={
                  casino.has_affiliate_link && !casino.joined
                    ? {
                        kind: 'affiliate',
                        href: null,
                        fallbackUrl: casino.affiliate_link_url,
                      }
                    : {
                        kind: 'profile',
                        href: `/casinos/${casino.slug}`,
                        fallbackUrl: null,
                      }
                }
                referrerSource="directory"
              />
            ))}
          </div>
          <div className="desktop-table-wrap">
            <table className="desktop-table">
              <thead>
                <tr>
                  <th>Casino Name</th>
                  <th>Tier</th>
                  <th>Risk</th>
                  <th>Live Games</th>
                  <th>Redemption Speed</th>
                  <th>Daily SC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((casino) => (
                  <tr key={casino.id}>
                    <td>
                      <a
                        href={
                          casino.has_affiliate_link && !casino.joined
                            ? '#'
                            : `/casinos/${casino.slug}`
                        }
                        data-fallback-url={casino.affiliate_link_url ?? undefined}
                        className="casino-link"
                        onClick={(event) => void openAffiliate(event, casino)}
                      >
                        {casino.name}
                      </a>
                    </td>
                    <td>
                      <span
                        style={{
                          ...getTierStyles(casino.tier),
                          borderRadius: '999px',
                          padding: '0.3rem 0.6rem',
                          display: 'inline-flex',
                          fontWeight: 700,
                        }}
                      >
                        Tier {casino.tier}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color: riskColors[casino.promoban_risk] ?? '#6B7280',
                          fontWeight: 700,
                          textTransform: 'capitalize',
                        }}
                      >
                        {casino.promoban_risk}
                      </span>
                    </td>
                    <td>
                      <LiveGamesIndicator hasLiveGames={casino.has_live_games} />
                    </td>
                    <td>{casino.redemption_speed_desc ?? 'Unknown'}</td>
                    <td>{casino.daily_bonus_desc ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style>{`
        .directory-shell {
          display: grid;
          gap: 1.5rem;
        }

        .filters {
          display: flex;
          gap: 0.75rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
        }

        .chip-group {
          display: flex;
          gap: 0.65rem;
        }

        .chip {
          border: 1px solid var(--color-border);
          background: #fff;
          color: var(--color-muted);
          border-radius: 999px;
          padding: 0.7rem 0.95rem;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }

        .chip-active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: #fff;
        }

        .table-toolbar {
          display: flex;
          justify-content: flex-end;
        }

        .table-toolbar label {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--color-muted);
        }

        .table-toolbar select {
          border-radius: 999px;
          border: 1px solid var(--color-border);
          padding: 0.65rem 0.85rem;
          font: inherit;
        }

        .mobile-list {
          display: grid;
          gap: 1rem;
        }

        .desktop-table-wrap {
          display: none;
        }

        .empty-state {
          border: 1px dashed var(--color-border);
          border-radius: 1.5rem;
          padding: 2rem;
          text-align: center;
          color: var(--color-muted);
          background: rgba(255, 255, 255, 0.75);
        }

        .desktop-table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: 1.5rem;
          overflow: hidden;
        }

        .desktop-table th,
        .desktop-table td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid var(--color-border-subtle);
          vertical-align: middle;
        }

        .casino-link {
          color: var(--color-ink);
          text-decoration: none;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .casino-link:hover {
          color: var(--color-primary);
        }

        @media (min-width: 900px) {
          .mobile-list {
            display: none;
          }

          .desktop-table-wrap {
            display: block;
          }
        }
      `}</style>
    </section>
  );
}

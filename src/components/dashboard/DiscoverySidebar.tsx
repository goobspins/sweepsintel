import type { DashboardDiscovery, DashboardDiscoveryCasino } from './types';
import {
  buildCompactPitch,
  buildDiscoveryPitch,
  buildSpotlightFacts,
  getDiscoveryCardAccentStyle,
  getDiscoveryHealthLabel,
  getDiscoveryHealthStyle,
  getDiscoveryLead,
  getTierBadgeStyle,
  hasDiscoveryAffiliateLink,
} from './utils';

interface DiscoverySidebarProps {
  discovery: DashboardDiscovery;
  spotlightCasino: DashboardDiscoveryCasino;
  compactDiscovery: DashboardDiscoveryCasino[];
  onToggleCollapse: () => void;
}

export default function DiscoverySidebar({
  discovery,
  spotlightCasino,
  compactDiscovery,
  onToggleCollapse,
}: DiscoverySidebarProps) {
  return (
    <aside className="surface-card discovery-sidebar discovery-sidebar-docked">
      <div className="discovery-header">
        <div className="discovery-header-row">
          <div>
            <div className="eyebrow">Casinos you're missing</div>
            <p className="muted section-copy">
              {discovery.homeState ? `Personalized for ${discovery.homeState}` : 'Recommended for you'}
            </p>
          </div>
          <button type="button" className="discovery-collapse" onClick={onToggleCollapse} aria-label="Collapse discovery">
            {'<'}
          </button>
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
            {getDiscoveryHealthLabel(spotlightCasino.promoban_risk) ? (
              <span className="health-pill" style={getDiscoveryHealthStyle(spotlightCasino.promoban_risk)}>
                {getDiscoveryHealthLabel(spotlightCasino.promoban_risk)}
              </span>
            ) : null}
          </div>
          <p className="spotlight-pitch">{buildDiscoveryPitch(spotlightCasino)}</p>
          {buildSpotlightFacts(spotlightCasino).length > 0 ? (
            <div className="spotlight-facts">
              {buildSpotlightFacts(spotlightCasino).map((fact) => (
                <div key={fact.label} className="spotlight-fact">
                  <span className="spotlight-fact-label">{fact.label}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="spotlight-actions">
          <a
            href={hasDiscoveryAffiliateLink(spotlightCasino) ? spotlightCasino.affiliate_link_url! : `/casinos/${spotlightCasino.slug}`}
            className="spotlight-primary"
            target={hasDiscoveryAffiliateLink(spotlightCasino) ? '_blank' : undefined}
            rel={hasDiscoveryAffiliateLink(spotlightCasino) ? 'noopener noreferrer' : undefined}
          >
            {hasDiscoveryAffiliateLink(spotlightCasino) ? 'Sign Up ->' : 'Full Profile ->'}
          </a>
          {hasDiscoveryAffiliateLink(spotlightCasino) ? (
            <a href={`/casinos/${spotlightCasino.slug}`} className="spotlight-secondary">Full Profile {'->'}</a>
          ) : null}
        </div>
      </div>

      {compactDiscovery.length > 0 ? (
        <div className="discovery-grid">
          {compactDiscovery.map((casino) => (
            <article key={casino.id} className="discovery-card" style={getDiscoveryCardAccentStyle(casino.tier)}>
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
              {buildCompactPitch(casino) ? <p className="discovery-card-copy">{buildCompactPitch(casino)}</p> : null}
              <div className="discovery-card-actions">
                <a href={`/casinos/${casino.slug}`} className="discovery-link">Profile</a>
                {hasDiscoveryAffiliateLink(casino) ? (
                  <a
                    href={casino.affiliate_link_url!}
                    className="discovery-link discovery-link-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Sign Up
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <a href="/casinos" className="explore-link">Explore All Casinos {'->'}</a>
      <style>{`
        .discovery-sidebar {
          display: grid;
          gap: 1rem;
          padding: 1.2rem;
          background: rgba(17, 24, 39, 0.65);
          border-left: 1px solid var(--color-border);
          align-content: start;
        }
        .discovery-sidebar-docked { position: static; max-height: none; overflow: visible; }
        .discovery-header { display: grid; gap: 0.35rem; }
        .discovery-header-row { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; flex-wrap:wrap; }
        .eyebrow { color: var(--text-muted); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
        .section-copy { margin: 0; }
        .muted { color: var(--text-muted); }
        .discovery-collapse { border:none; background:transparent; color:var(--text-muted); font:inherit; font-weight:800; cursor:pointer; padding:0; font-size:1rem; line-height:1; }
        .discovery-spotlight { display: grid; gap: 1rem; padding: 1rem; border-radius: 1.35rem; border: 1px solid rgba(59, 130, 246, 0.24); background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(17, 24, 39, 0.58)); }
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
        .spotlight-primary, .discovery-link { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0.78rem 1rem; text-decoration: none; font-weight: 700; white-space: nowrap; }
        .spotlight-primary, .discovery-link-primary { background: var(--accent-green); color: #0b1220; font-weight: 800; }
        .spotlight-primary { width: 100%; }
        .spotlight-secondary, .discovery-link { border: 1px solid var(--color-border); color: var(--text-primary); background: rgba(17, 24, 39, 0.42); }
        .spotlight-secondary { color: var(--text-secondary); text-decoration: none; font-weight: 700; justify-self: start; }
        .discovery-grid { display: grid; gap: 0.9rem; grid-template-columns: 1fr; }
        .discovery-card { display: grid; gap: 0.85rem; padding: 1rem; border-radius: 1.2rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.46); }
        .discovery-card-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; }
        .discovery-card-title { color: var(--text-primary); text-decoration: none; font-size: 1rem; font-weight: 800; letter-spacing: -0.03em; }
        .discovery-card-meta { display: flex; align-items: center; gap: 0.45rem; color: var(--text-muted); font-size: 0.86rem; margin-top: 0.3rem; }
        .discovery-card-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
        .tier-badge { display: inline-flex; min-width: 2rem; justify-content: center; border-radius: 999px; padding: 0.25rem 0.55rem; font-size: 0.78rem; font-weight: 800; border: 1px solid transparent; }
        .explore-link { color: var(--accent-blue); text-decoration: none; font-weight: 700; }
        @media (max-width: 1180px) { .spotlight-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 1024px) { .discovery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) {
          .spotlight-facts, .discovery-grid { grid-template-columns: 1fr; }
          .spotlight-primary, .spotlight-secondary, .discovery-link { width: 100%; }
          .spotlight-actions, .discovery-card-actions { grid-auto-flow: row; display: grid; }
        }
      `}</style>
    </aside>
  );
}

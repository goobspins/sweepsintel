import { formatAgo } from '../../lib/format';
import type { DashboardDiscovery, DashboardDiscoveryCasino } from './types';
import { buildCompactPitch, getDiscoveryCardAccentStyle, getDiscoveryLead, getTierBadgeStyle, hasDiscoveryAffiliateLink } from './utils';

interface UnderfoldSectionProps {
  discovery: DashboardDiscovery;
  fullDiscovery: DashboardDiscoveryCasino[];
  casinoCount: number;
  showDiscoveryGrid: boolean;
}

export default function UnderfoldSection({
  discovery,
  fullDiscovery,
  casinoCount,
  showDiscoveryGrid,
}: UnderfoldSectionProps) {
  return (
    <section className="surface-card underfold-section">
      <div className="underfold-grid">
        <div className="earnings-prompt">
          <div className="eyebrow">Earnings Prompt</div>
          <h3 className="underfold-title">Growth prompt</h3>
          <p className="muted underfold-copy">
            {discovery.stateRequired
              ? 'Set your state in Settings to see personalized recommendations.'
              : discovery.estimatedDailyUsd && discovery.estimatedDailyUsd > 0
                ? `You're tracking ${casinoCount} casinos. Adding these ${fullDiscovery.length} could earn you an estimated $${discovery.estimatedDailyUsd.toFixed(2)} more per day in daily bonuses.`
                : `There are ${fullDiscovery.length} casinos available in your state you haven't signed up at yet.`}
          </p>
        </div>
        {discovery.latestSignal ? (
          <div className="latest-signal-card">
            <div className="eyebrow">Latest Signal</div>
            <strong>{discovery.latestSignal.title}</strong>
            <span className="muted">
              {discovery.latestSignal.casino_name ?? 'Community'} | {formatAgo(discovery.latestSignal.created_at)}
            </span>
            <a href="/intel" className="explore-link">View all signals {'->'}</a>
          </div>
        ) : null}
      </div>
      {fullDiscovery.length > 0 && showDiscoveryGrid ? (
        <div className="full-discovery-grid">
          {fullDiscovery.map((casino) => (
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
                  <a href={casino.affiliate_link_url!} className="discovery-link discovery-link-primary" target="_blank" rel="noopener noreferrer">
                    Sign Up
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <style>{`
        .underfold-section { display:grid; gap:1rem; padding:1.2rem; }
        .underfold-grid { display:grid; gap:1rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .earnings-prompt, .latest-signal-card { display:grid; gap:.45rem; padding:1rem; border:1px solid var(--color-border); border-radius:1rem; background:rgba(17,24,39,.42); }
        .eyebrow { color: var(--text-muted); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
        .underfold-title { margin:0; font-size:1.1rem; }
        .underfold-copy, .discovery-card-copy { margin:0; line-height:1.6; color:var(--text-secondary); }
        .muted { color: var(--text-muted); }
        .explore-link { color: var(--accent-blue); text-decoration: none; font-weight: 700; }
        .full-discovery-grid { display:grid; gap:.9rem; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); }
        .discovery-card { display: grid; gap: 0.85rem; padding: 1rem; border-radius: 1.2rem; border: 1px solid var(--color-border); background: rgba(17, 24, 39, 0.46); }
        .discovery-card-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; }
        .discovery-card-title { color: var(--text-primary); text-decoration: none; font-size: 1rem; font-weight: 800; letter-spacing: -0.03em; }
        .discovery-card-meta { display: flex; align-items: center; gap: 0.45rem; color: var(--text-muted); font-size: 0.86rem; margin-top: 0.3rem; }
        .discovery-card-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
        .discovery-link { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0.78rem 1rem; text-decoration: none; font-weight: 700; white-space: nowrap; border: 1px solid var(--color-border); color: var(--text-primary); background: rgba(17, 24, 39, 0.42); }
        .discovery-link-primary { background: var(--accent-green); color: #0b1220; font-weight: 800; }
        .tier-badge { display: inline-flex; min-width: 2rem; justify-content: center; border-radius: 999px; padding: 0.25rem 0.55rem; font-size: 0.78rem; font-weight: 800; border: 1px solid transparent; }
        @media (max-width: 1024px) { .underfold-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

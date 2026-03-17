import { useState } from 'react';

import { getTierStyles } from '../../lib/casino-tier';

const riskColors: Record<string, string> = {
  none: 'var(--accent-green)',
  low: 'var(--accent-green)',
  medium: 'var(--accent-yellow)',
  high: 'var(--accent-red)',
  unknown: 'var(--text-muted)',
};

interface StateCardProps {
  casino: {
    id: number;
    slug: string;
    name: string;
    tier: string;
    promoban_risk: string;
  };
  destination: {
    kind: 'affiliate' | 'profile';
    href: string | null;
    fallbackUrl: string | null;
  };
  referrerSource: string;
}

export default function StateCard({
  casino,
  destination,
  referrerSource,
}: StateCardProps) {
  const [pending, setPending] = useState(false);
  const tierStyles = getTierStyles(casino.tier);

  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (destination.kind !== 'affiliate' || !destination.fallbackUrl) {
      return;
    }

    event.preventDefault();
    if (pending) {
      return;
    }

    setPending(true);
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3000);
      const response = await fetch('/api/affiliate/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: casino.id,
          referrer_source: referrerSource,
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const data = await response.json();
      window.open(data.url || destination.fallbackUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      window.open(destination.fallbackUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="state-card">
      <div className="state-card-head">
        <a
          href={destination.href ?? '#'}
          onClick={handleClick}
          data-fallback-url={destination.fallbackUrl ?? undefined}
          className="casino-link"
        >
          {pending ? `${casino.name} ...` : `${casino.name} ->`}
        </a>
        <span className="tier-badge">Tier {casino.tier}</span>
      </div>
      <div className="meta-row">
        <span style={{ color: riskColors[casino.promoban_risk] ?? 'var(--text-muted)', fontWeight: 700 }}>
          {casino.promoban_risk} risk
        </span>
      </div>

      <style>{`
        .state-card {
          display:grid; gap:.75rem; padding:1rem; border-radius:1.25rem;
          border:1px solid var(--color-border); background:var(--color-surface);
        }
        .state-card-head, .meta-row {
          display:flex; justify-content:space-between; gap:.75rem; align-items:flex-start; flex-wrap:wrap;
        }
        .casino-link {
          color:var(--color-ink); text-decoration:none; font-weight:800; letter-spacing:-.03em;
        }
        .tier-badge {
          border-radius:999px; padding:.3rem .6rem; font-weight:700;
          background:${tierStyles.background}; color:${tierStyles.color};
        }
        .meta-row { color:var(--color-muted); }
      `}</style>
    </article>
  );
}


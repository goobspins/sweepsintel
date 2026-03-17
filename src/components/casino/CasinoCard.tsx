import { useState } from 'react';

import { getTierStyles } from '../../lib/casino-tier';
import LiveGamesIndicator from './LiveGamesIndicator';

interface CasinoCardProps {
  casino: {
    id: number;
    slug: string;
    name: string;
    tier: string;
    promoban_risk: string;
    has_live_games: boolean;
    redemption_speed_desc: string | null;
    daily_bonus_desc?: string | null;
    has_affiliate_link: boolean;
    affiliate_link_url: string | null;
  };
  destination: {
    kind: 'affiliate' | 'profile';
    href: string | null;
    fallbackUrl: string | null;
  };
  referrerSource: string;
}

const riskColors: Record<string, string> = {
  none: 'var(--accent-green)',
  low: 'var(--accent-green)',
  medium: 'var(--accent-yellow)',
  high: 'var(--accent-red)',
  unknown: 'var(--text-muted)',
};

export default function CasinoCard({
  casino,
  destination,
  referrerSource,
}: CasinoCardProps) {
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
      const url = data.url || destination.fallbackUrl;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      window.open(destination.fallbackUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setPending(false);
    }
  }

  return (
    <article
      style={{
        display: 'grid',
        gap: '0.8rem',
        padding: '1rem',
        borderRadius: '1.5rem',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.22)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <a
          href={destination.href ?? '#'}
          onClick={handleClick}
          data-fallback-url={destination.fallbackUrl ?? undefined}
          style={{
            color: 'var(--color-ink)',
            textDecoration: 'none',
            fontWeight: 800,
            fontSize: '1.08rem',
            letterSpacing: '-0.03em',
          }}
        >
          {pending ? `${casino.name} ...` : `${casino.name} ->`}
        </a>
        <span
          style={{
            borderRadius: '999px',
            padding: '0.3rem 0.6rem',
            background: tierStyles.background,
            color: tierStyles.color,
            fontWeight: 700,
          }}
        >
          Tier {casino.tier}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          color: 'var(--color-muted)',
        }}
      >
        <span
          style={{
            color: riskColors[casino.promoban_risk] ?? 'var(--text-muted)',
            fontWeight: 700,
            textTransform: 'capitalize',
          }}
        >
          {casino.promoban_risk} risk
        </span>
        <LiveGamesIndicator hasLiveGames={casino.has_live_games} />
      </div>

      <div style={{ color: 'var(--color-muted)' }}>
        Redemption: {casino.redemption_speed_desc ?? 'Unknown'}
      </div>

      {casino.daily_bonus_desc ? (
        <div style={{ color: 'var(--color-muted)' }}>
          Daily SC: {casino.daily_bonus_desc}
        </div>
      ) : null}
    </article>
  );
}


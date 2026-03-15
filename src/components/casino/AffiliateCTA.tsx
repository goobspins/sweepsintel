import { useEffect, useState } from 'react';

interface AffiliateCTAProps {
  casinoId: number;
  fallbackUrl: string | null;
  directUrl: string;
  hasAffiliate: boolean;
  joined: boolean;
  referrerSource: string;
  joinLabel?: string;
  visitLabel?: string;
  variant?: 'button' | 'bar';
}

export default function AffiliateCTA({
  casinoId,
  fallbackUrl,
  directUrl,
  hasAffiliate,
  joined,
  referrerSource,
  joinLabel = 'Join Casino ->',
  visitLabel = 'Visit Casino ->',
  variant = 'button',
}: AffiliateCTAProps) {
  const [pending, setPending] = useState(false);
  const [showBar, setShowBar] = useState(variant !== 'bar');
  const shouldAffiliate = Boolean(hasAffiliate && !joined && fallbackUrl);

  useEffect(() => {
    if (variant !== 'bar') {
      return;
    }

    const onScroll = () => setShowBar(window.scrollY > 360);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  async function handleAffiliateClick(
    event: React.MouseEvent<HTMLAnchorElement>,
  ) {
    if (!shouldAffiliate || !fallbackUrl) {
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
          casino_id: casinoId,
          referrer_source: referrerSource,
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      const data = await response.json();
      window.open(data.url || fallbackUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setPending(false);
    }
  }

  if (variant === 'bar' && (!showBar || joined)) {
    return null;
  }

  const label = shouldAffiliate ? joinLabel : visitLabel;
  const href = shouldAffiliate ? '#' : directUrl;
  const className = variant === 'bar' ? 'cta-bar' : 'cta-button';

  return (
    <>
      <a
        href={href}
        onClick={handleAffiliateClick}
        data-fallback-url={fallbackUrl ?? undefined}
        className={className}
        target={shouldAffiliate ? '_blank' : undefined}
        rel={shouldAffiliate ? 'noopener noreferrer' : undefined}
      >
        {pending ? 'Opening...' : label}
      </a>
      <style>{`
        .cta-button,
        .cta-bar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-weight: 700;
          border-radius: 999px;
        }

        .cta-button {
          width: fit-content;
          padding: 0.9rem 1.2rem;
          background: ${shouldAffiliate ? 'var(--color-primary)' : '#fff'};
          color: ${shouldAffiliate ? '#fff' : 'var(--color-ink)'};
          border: 1px solid ${shouldAffiliate ? 'var(--color-primary)' : 'var(--color-border)'};
        }

        .cta-bar {
          position: fixed;
          bottom: 1rem;
          left: 1rem;
          right: 1rem;
          padding: 1rem 1.2rem;
          background: var(--color-primary);
          color: #fff;
          box-shadow: 0 20px 40px rgba(37, 99, 235, 0.25);
          z-index: 30;
        }

        @media (min-width: 768px) {
          .cta-bar {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

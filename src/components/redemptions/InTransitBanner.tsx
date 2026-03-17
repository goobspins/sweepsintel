import { formatCurrency } from '../../lib/format';

interface InTransitBannerProps {
  totalUsd: number;
  pendingCount: number;
}

export default function InTransitBanner({ totalUsd, pendingCount }: InTransitBannerProps) {
  if (pendingCount <= 0) {
    return null;
  }

  return (
    <div className="in-transit-banner">
      In Transit: {formatCurrency(totalUsd)} - {pendingCount} pending redemption{pendingCount === 1 ? '' : 's'}
      <style>{`
        .in-transit-banner {
          border: 1px solid rgba(217, 119, 6, 0.25);
          background: rgba(245, 158, 11, 0.16);
          color: var(--accent-yellow);
          border-radius: 1rem;
          padding: 0.95rem 1rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}


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
          background: #fff7ed;
          color: #9a3412;
          border-radius: 1rem;
          padding: 0.95rem 1rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

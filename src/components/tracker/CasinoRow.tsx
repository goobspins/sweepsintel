import ClaimModal from './ClaimModal';
import ResetCountdown from './ResetCountdown';

export interface CasinoRowViewModel {
  casinoId: number;
  name: string;
  slug: string;
  tier: string;
  source: string;
  dailyBonusDesc: string | null;
  sortOrder: number | null;
  resetMode: string | null;
  resetTimeLocal: string | null;
  resetTimezone: string | null;
  resetIntervalHours: number;
  hasStreaks: boolean;
  noDailyReward: boolean;
  todayClaimId: number | null;
  todaySc: number | string | null;
  todayClaimedAt: string | null;
  lastClaimedAt: string | null;
  status: 'available' | 'countdown' | 'claimed' | 'no-daily';
  streakText: string | null;
  destinationUrl: string;
  destinationKind: 'affiliate' | 'claim' | 'profile';
}

interface CasinoRowProps {
  casino: CasinoRowViewModel;
  ledgerMode: 'simple' | 'advanced';
  userTimezone: string;
  nowTs: number;
  pending: boolean;
  expanded: boolean;
  onClaimSimple: () => void;
  onClaimAdvancedOpen: () => void;
  onClaimAdvancedCommit: (scAmount: number | null) => Promise<void>;
  onClaimAdvancedCancel: () => void;
  onRemove: () => void;
}

export default function CasinoRow({
  casino,
  ledgerMode,
  userTimezone,
  nowTs,
  pending,
  expanded,
  onClaimSimple,
  onClaimAdvancedOpen,
  onClaimAdvancedCommit,
  onClaimAdvancedCancel,
  onRemove,
}: CasinoRowProps) {
  const isClaimed = casino.status === 'claimed';
  const isNoDaily = casino.status === 'no-daily';
  const canClaim = casino.status === 'available';

  async function handleCasinoClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (casino.destinationKind !== 'affiliate') {
      return;
    }

    try {
      if (navigator.sendBeacon) {
        const payload = JSON.stringify({
          casino_id: casino.casinoId,
          referrer_source: 'tracker_name',
        });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/affiliate/click', blob);
        return;
      }

      void fetch('/api/affiliate/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: casino.casinoId,
          referrer_source: 'tracker_name',
        }),
        keepalive: true,
      });
    } catch (error) {
      console.error(error);
    }
  }

  const rowClass =
    casino.status === 'available'
      ? 'row row-available'
      : casino.status === 'no-daily'
        ? 'row row-no-daily'
      : casino.status === 'claimed'
        ? 'row row-claimed'
        : 'row';

  const claimLabel =
    ledgerMode === 'advanced' && isClaimed && casino.todaySc !== null
      ? `Claimed ${casino.todaySc} SC`
      : 'Claimed';

  return (
    <article className={rowClass}>
      <div className="row-main">
        <div className="row-copy">
          {casino.source === 'admin' ? (
            <a
              href={casino.destinationUrl}
              className="casino-link"
              onClick={(event) => void handleCasinoClick(event)}
              target={casino.destinationKind !== 'profile' ? '_blank' : undefined}
              rel={casino.destinationKind !== 'profile' ? 'noopener' : undefined}
            >
              {casino.name}
            </a>
          ) : (
            <span className="casino-link">{casino.name}</span>
          )}
          <div className="row-meta">
            {isNoDaily ? (
              <span className="no-daily-label">No daily reward</span>
            ) : (
              <ResetCountdown
                resetMode={casino.resetMode}
                resetTimeLocal={casino.resetTimeLocal}
                resetTimezone={casino.resetTimezone}
                resetIntervalHours={casino.resetIntervalHours}
                lastClaimedAt={casino.lastClaimedAt}
                claimedToday={isClaimed}
                userTimezone={userTimezone}
                nowTs={nowTs}
              />
            )}
            {casino.streakText ? <span>{casino.streakText}</span> : null}
            {casino.dailyBonusDesc ? <span>{casino.dailyBonusDesc}</span> : null}
          </div>
        </div>
        <div className="row-actions">
          {isClaimed ? (
            <span className="claimed-badge">{claimLabel}</span>
          ) : canClaim ? (
            <button
              type="button"
              className="claim-button"
              onClick={ledgerMode === 'advanced' ? onClaimAdvancedOpen : onClaimSimple}
              disabled={pending}
            >
              {pending ? 'Saving...' : 'Claim'}
            </button>
          ) : null}
          <button type="button" className="remove-button" onClick={onRemove}>
            x
          </button>
        </div>
      </div>
      {expanded ? (
        <ClaimModal
          onCommit={onClaimAdvancedCommit}
          onCancel={onClaimAdvancedCancel}
        />
      ) : null}
      <style>{`
        .row {
          display: grid;
          gap: 1rem;
          padding: 1rem;
          border-radius: 1.25rem;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
        }

        .row-available {
          border-left: 6px solid var(--color-success);
          background: rgba(16, 185, 129, 0.1);
        }

        .row-claimed {
          background: rgba(59, 130, 246, 0.08);
        }

        .row-no-daily {
          background: rgba(55, 65, 81, 0.5);
          color: var(--color-muted);
        }

        .row-main {
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          align-items: flex-start;
        }

        .row-copy {
          display: grid;
          gap: 0.5rem;
        }

        .casino-link {
          color: var(--color-ink);
          text-decoration: none;
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .row-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          color: var(--color-muted);
          font-size: 0.94rem;
        }

        .no-daily-label {
          font-weight: 700;
        }

        .row-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
        }

        .claim-button,
        .claimed-badge,
        .remove-button {
          border-radius: 999px;
          padding: 0.72rem 0.95rem;
          font: inherit;
          font-weight: 700;
        }

        .claim-button {
          border: none;
          background: var(--color-primary);
          color: var(--text-primary);
          cursor: pointer;
        }

        .claimed-badge {
          background: rgba(16, 185, 129, 0.14);
          color: var(--color-success);
        }

        .remove-button {
          border: 1px solid var(--color-border);
          background: var(--bg-primary);
          color: var(--color-muted);
          cursor: pointer;
        }

        @media (max-width: 639px) {
          .row-main {
            flex-direction: column;
          }

          .row-actions {
            width: 100%;
            justify-content: flex-start;
          }
        }
      `}</style>
    </article>
  );
}


interface SummaryBreakdown {
  casino_id: number;
  casino_name: string;
  net_usd: number;
  net_sc: number;
  available_sc: number;
}

interface LedgerSummaryProps {
  summary: {
    total_in_usd: number;
    total_out_usd: number;
    net_pl_usd: number;
    breakdown: SummaryBreakdown[];
  };
  ledgerMode: 'simple' | 'advanced';
}

export default function LedgerSummary({ summary, ledgerMode }: LedgerSummaryProps) {
  return (
    <section className="surface-card summary-card">
      <div className="summary-grid">
        <div>
          <span className="muted">Total In</span>
          <strong className="summary-positive">{formatCurrency(summary.total_in_usd)}</strong>
        </div>
        <div>
          <span className="muted">Total Out</span>
          <strong>{formatCurrency(summary.total_out_usd)}</strong>
        </div>
        <div>
          <span className="muted">Net P/L</span>
          <strong className={summary.net_pl_usd > 0 ? 'summary-positive' : summary.net_pl_usd < 0 ? 'summary-negative' : ''}>
            {summary.net_pl_usd > 0 ? '↑ ' : summary.net_pl_usd < 0 ? '↓ ' : ''}
            {formatCurrency(summary.net_pl_usd)}
          </strong>
        </div>
      </div>

      <details className="breakdown">
        <summary>Per-casino P/L breakdown</summary>
        <div className="breakdown-list">
          {summary.breakdown.map((row) => (
            <div key={row.casino_id} className="breakdown-row">
              <div>
                <strong>{row.casino_name}</strong>
                {ledgerMode === 'advanced' ? (
                  <span className="muted">Available SC: {formatSc(row.available_sc)}</span>
                ) : null}
              </div>
              <strong className={row.net_usd > 0 ? 'summary-positive' : row.net_usd < 0 ? 'summary-negative' : ''}>
                {formatCurrency(row.net_usd)}
              </strong>
            </div>
          ))}
        </div>
      </details>

      <style>{`
        .summary-card {
          padding: 1.25rem;
          display: grid;
          gap: 1rem;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .summary-grid div {
          display: grid;
          gap: 0.35rem;
          padding: 0.95rem;
          border-radius: 1rem;
          background: var(--bg-secondary);
        }

        .summary-grid strong,
        .breakdown-row strong {
          font-size: 1.1rem;
        }

        .summary-positive { color: var(--color-success); }
        .summary-negative { color: var(--color-danger); }

        .breakdown summary {
          cursor: pointer;
          font-weight: 700;
        }

        .breakdown-list {
          display: grid;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          padding-top: 0.75rem;
          border-top: 1px solid var(--color-border);
        }

        .breakdown-row div {
          display: grid;
          gap: 0.25rem;
        }

        @media (max-width: 767px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatSc(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}


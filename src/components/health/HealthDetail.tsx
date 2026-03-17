import HealthDot from './HealthDot';

interface HealthDetailProps {
  detail: {
    personal_status: string;
    status_reason: string | null;
    active_warning_count: number;
    pending_redemptions_count: number;
    pending_redemptions_usd: number;
    sc_exposure: number;
    exposure_reason: string | null;
    warning_signals: Array<{
      id: number;
      title: string;
      content: string;
      worked_count: number;
      didnt_work_count: number;
      signal_status: string;
      created_at: string;
    }>;
  };
}

export default function HealthDetail({ detail }: HealthDetailProps) {
  return (
    <div className="health-detail">
      <div className="health-summary">
        <div className="health-head">
          <HealthDot status={detail.personal_status} size={14} pulse />
          <strong>{detail.personal_status.replace(/_/g, ' ')}</strong>
        </div>
        {detail.status_reason ? <p>{detail.status_reason}</p> : null}
        {detail.exposure_reason ? <p>{detail.exposure_reason}</p> : null}
        <div className="health-metrics">
          <span>{detail.active_warning_count} active warnings</span>
          <span>{detail.pending_redemptions_count} pending redeems</span>
          <span>{detail.sc_exposure.toFixed(2)} SC exposure</span>
        </div>
      </div>
      {detail.warning_signals.length > 0 ? (
        <div className="signal-list">
          {detail.warning_signals.map((signal) => (
            <article key={signal.id} className="signal-row">
              <strong>{signal.title}</strong>
              <span className="muted">{signal.content}</span>
              <span className="muted">
                {signal.worked_count} worked · {signal.didnt_work_count} didn&apos;t work
              </span>
            </article>
          ))}
        </div>
      ) : null}
      <style>{`
        .health-detail { display:grid; gap:.85rem; }
        .health-summary, .signal-row {
          display:grid; gap:.4rem; padding:.85rem; border:1px solid var(--color-border); border-radius:1rem; background:rgba(17, 24, 39, 0.42);
        }
        .health-summary p { margin:0; color:var(--text-secondary); line-height:1.5; }
        .health-head, .health-metrics { display:flex; gap:.6rem; flex-wrap:wrap; align-items:center; }
        .health-metrics { color:var(--text-muted); font-size:.9rem; }
        .signal-list { display:grid; gap:.65rem; }
        .muted { color:var(--text-muted); }
      `}</style>
    </div>
  );
}

interface PulloutAlertBannerProps {
  stateName: string;
  alerts: Array<{
    id: number;
    casino_name: string | null;
    alert_message: string | null;
    created_at: string;
  }>;
}

export default function PulloutAlertBanner({
  stateName,
  alerts,
}: PulloutAlertBannerProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <section className="alert-banner">
      {alerts.map((alert) => (
        <div key={alert.id} className="alert-row">
          <strong>
            ⚠️ {alert.casino_name ?? 'A casino'} stopped accepting players in {stateName}
          </strong>
          <span>{new Date(alert.created_at).toLocaleDateString()}</span>
        </div>
      ))}

      <style>{`
        .alert-banner {
          display:grid; gap:.75rem; padding:1rem; border-radius:1rem;
          background:rgba(245, 158, 11, 0.16); border:1px solid rgba(217, 119, 6, 0.25); color:var(--accent-yellow);
        }
        .alert-row {
          display:flex; justify-content:space-between; gap:.75rem; flex-wrap:wrap; align-items:flex-start;
        }
      `}</style>
    </section>
  );
}


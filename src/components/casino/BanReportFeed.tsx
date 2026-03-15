interface BanReport {
  id: number;
  report_type: string;
  description: string;
  submitted_at: string;
}

interface BanReportFeedProps {
  reports: BanReport[];
}

export default function BanReportFeed({ reports }: BanReportFeedProps) {
  if (reports.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--color-muted)' }}>
        No ban reports for this casino. That&apos;s a good sign.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      {reports.map((report) => (
        <article
          key={report.id}
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: '1.25rem',
            padding: '1rem',
            background: '#fff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '0.45rem',
            }}
          >
            <strong style={{ textTransform: 'capitalize' }}>
              {report.report_type.replace(/_/g, ' ')}
            </strong>
            <span style={{ color: 'var(--color-muted)' }}>
              {new Date(report.submitted_at).toLocaleDateString()}
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--color-muted)', lineHeight: 1.6 }}>
            {report.description}
          </p>
        </article>
      ))}
    </div>
  );
}

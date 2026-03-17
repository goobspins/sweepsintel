interface SignalTrackerProps {
  items: Array<{
    id: number;
    casino_name: string | null;
    source: string;
    title: string;
    item_type: string;
    signal_status: string;
    worked_count: number;
    didnt_work_count: number;
    created_at: string;
  }>;
}

export default function SignalTracker({ items }: SignalTrackerProps) {
  return (
    <section className="surface-card tracker-card">
      <h2 style={{ margin: '0 0 1rem' }}>Live Signal Tracker</h2>
      <table>
        <thead>
          <tr>
            <th>Casino</th>
            <th>Title</th>
            <th>Type</th>
            <th>Status</th>
            <th>Source</th>
            <th>Votes</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.casino_name ?? 'General'}</td>
              <td>{item.title}</td>
              <td>{item.item_type.replace(/_/g, ' ')}</td>
              <td>{item.signal_status.replace(/_/g, ' ')}</td>
              <td>{item.source}</td>
              <td>{item.worked_count} / {item.didnt_work_count}</td>
              <td>{new Date(item.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        .tracker-card { padding:1.1rem; }
        table { width:100%; border-collapse:collapse; }
        th, td { padding:.85rem; border-bottom:1px solid var(--color-border); text-align:left; vertical-align:top; }
      `}</style>
    </section>
  );
}

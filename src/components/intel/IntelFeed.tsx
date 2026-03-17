import { useMemo, useState } from 'react';

import SignalCard from './SignalCard';
import SignalSubmitForm from './SignalSubmitForm';

interface IntelFeedProps {
  user: any;
  initialData: {
    items: any[];
    trackedCasinos: Array<{ casino_id: number; name: string; slug: string }>;
  };
}

export default function IntelFeed({ initialData }: IntelFeedProps) {
  const [items, setItems] = useState(initialData.items);
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('7d');
  const [selectedCasinos, setSelectedCasinos] = useState<number[]>(
    initialData.trackedCasinos.map((casino) => casino.casino_id),
  );

  const filteredItems = useMemo(() => {
    const now = Date.now();
    const sinceMs =
      timeFilter === '24h' ? 24 * 60 * 60 * 1000 :
      timeFilter === '30d' ? 30 * 24 * 60 * 60 * 1000 :
      timeFilter === 'all' ? Number.POSITIVE_INFINITY :
      7 * 24 * 60 * 60 * 1000;
    return items.filter((item) => {
      if (item.casino && !selectedCasinos.includes(item.casino.id)) return false;
      if (typeFilter !== 'all') {
        const groups: Record<string, string[]> = {
          deals: ['flash_sale', 'playthrough_deal'],
          promos: ['promo_code'],
          free_sc: ['free_sc'],
          warnings: ['platform_warning'],
          strategy: ['general_tip'],
        };
        if (!(groups[typeFilter] ?? [typeFilter]).includes(item.item_type)) return false;
      }
      if (timeFilter !== 'all') {
        const createdAt = new Date(item.created_at).getTime();
        if (Number.isFinite(createdAt) && now - createdAt > sinceMs) return false;
      }
      return true;
    });
  }, [items, selectedCasinos, timeFilter, typeFilter]);

  async function handleVote(signalId: number, vote: 'worked' | 'didnt_work') {
    const response = await fetch(`/api/intel/vote/${signalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Unable to vote.');
    setItems((current) =>
      current.map((item) =>
        item.id === signalId
          ? {
              ...item,
              worked_count: data.worked_count,
              didnt_work_count: data.didnt_work_count,
              signal_status: data.signal_status,
            }
          : item,
      ),
    );
  }

  return (
    <div className="intel-shell">
      <section className="surface-card intel-hero">
        <div className="hero-copy">
          <div className="eyebrow">Intel Feed</div>
          <h1 className="section-title" style={{ margin: 0 }}>Intel Feed</h1>
          <p className="muted" style={{ margin: 0 }}>Intelligence for your tracked casinos</p>
        </div>
      </section>

      <section className="surface-card filter-bar">
        <div className="filter-groups">
          <div className="casino-filter">
            {initialData.trackedCasinos.map((casino) => (
              <label key={casino.casino_id} className="checkbox-pill">
                <input
                  type="checkbox"
                  checked={selectedCasinos.includes(casino.casino_id)}
                  onChange={(event) =>
                    setSelectedCasinos((current) =>
                      event.target.checked
                        ? [...current, casino.casino_id]
                        : current.filter((value) => value !== casino.casino_id),
                    )
                  }
                />
                <span>{casino.name}</span>
              </label>
            ))}
          </div>
          <div className="toolbar-row">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="deals">Deals</option>
              <option value="promos">Promo Codes</option>
              <option value="free_sc">Free SC</option>
              <option value="warnings">Warnings</option>
              <option value="strategy">Strategy</option>
            </select>
            <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)}>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
      </section>

      <SignalSubmitForm
        casinos={initialData.trackedCasinos}
        onCreated={(signal) => setItems((current) => [signal, ...current])}
      />

      <section className="signal-list">
        {filteredItems.map((item) => (
          <SignalCard key={item.id} item={item} onVote={handleVote} />
        ))}
      </section>

      <style>{`
        .intel-shell { display:grid; gap:1rem; }
        .intel-hero, .filter-bar { padding:1.1rem 1.2rem; }
        .eyebrow { color:var(--text-muted); font-size:.76rem; text-transform:uppercase; letter-spacing:.1em; font-weight:800; }
        .filter-groups, .toolbar-row, .casino-filter { display:flex; gap:.65rem; flex-wrap:wrap; align-items:center; }
        .checkbox-pill { display:inline-flex; gap:.4rem; align-items:center; padding:.52rem .72rem; border-radius:999px; border:1px solid var(--color-border); background:rgba(17, 24, 39, 0.42); color:var(--text-secondary); }
        .checkbox-pill input { width:auto; }
        .toolbar-row select { border:1px solid var(--color-border); border-radius:999px; padding:.7rem .9rem; background:var(--bg-primary); color:var(--text-primary); }
        .signal-list { display:grid; gap:.85rem; }
      `}</style>
    </div>
  );
}

import { useMemo, useState } from 'react';

import CasinoPerformanceTable from './CasinoPerformanceTable';
import EarningsOverview from './EarningsOverview';
import RecentActivityList from './RecentActivityList';
import ReportsKpiGrid from './ReportsKpiGrid';
import type { RecentActivityRow, ReportCasinoRow, ReportsSummary, SortKey } from './types';

type ReportsPanelProps = {
  initialSummary: ReportsSummary;
  initialCasinos: ReportCasinoRow[];
  initialRecentActivity: RecentActivityRow[];
};

export default function ReportsPanel({
  initialSummary,
  initialCasinos,
  initialRecentActivity,
}: ReportsPanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>('netPlUsd');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const casinoRows = useMemo(() => {
    const nextRows = [...initialCasinos];
    nextRows.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * direction;
      if (sortKey === 'lastActivityAt') {
        return (new Date(a.lastActivityAt ?? 0).getTime() - new Date(b.lastActivityAt ?? 0).getTime()) * direction;
      }
      return ((a[sortKey] as number) - (b[sortKey] as number)) * direction;
    });
    return nextRows;
  }, [initialCasinos, sortDirection, sortKey]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'name' ? 'asc' : 'desc');
  }

  return (
    <div className="reports-shell">
      <section className="surface-card reports-hero">
        <div className="eyebrow">Reports</div>
        <h1 className="section-title reports-title">Reports</h1>
        <p className="muted reports-subtitle">Your performance at a glance</p>
      </section>
      <ReportsKpiGrid summary={initialSummary} />
      <EarningsOverview summary={initialSummary} />
      <CasinoPerformanceTable rows={casinoRows} sortKey={sortKey} sortDirection={sortDirection} onToggleSort={toggleSort} />
      <RecentActivityList items={initialRecentActivity} />
      <style>{`
        .reports-shell { display:grid; gap:1.25rem; }
        .reports-hero { padding:1.25rem 1.35rem; }
        .reports-title { margin:.2rem 0 0; }
        .reports-subtitle { margin:.35rem 0 0; }
      `}</style>
    </div>
  );
}

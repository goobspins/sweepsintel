import { useMemo, useState, useTransition } from 'react';

import type { SignalItem, TrackedCasino } from './types';

export type IntelFilters = {
  typeFilter: string;
  timeFilter: string;
  selectedCasinoIds: number[];
};

interface UseIntelFiltersOptions {
  items: SignalItem[];
  trackedCasinos: TrackedCasino[];
}

export function useIntelFilters({ items, trackedCasinos }: UseIntelFiltersOptions) {
  const [filters, setFilterState] = useState<IntelFilters>({
    typeFilter: 'all',
    timeFilter: '7d',
    selectedCasinoIds: trackedCasinos.map((casino) => casino.casino_id),
  });
  const [isPending, startTransition] = useTransition();

  const filteredItems = useMemo(() => {
    const now = Date.now();
    const sinceMs =
      filters.timeFilter === '24h'
        ? 24 * 60 * 60 * 1000
        : filters.timeFilter === '30d'
          ? 30 * 24 * 60 * 60 * 1000
          : filters.timeFilter === 'all'
            ? Number.POSITIVE_INFINITY
            : 7 * 24 * 60 * 60 * 1000;

    return items.filter((item) => {
      if (filters.selectedCasinoIds.length > 0 && item.casino && !filters.selectedCasinoIds.includes(item.casino.id)) {
        return false;
      }

      if (filters.typeFilter !== 'all') {
        const groups: Record<string, string[]> = {
          deals: ['flash_sale', 'playthrough_deal'],
          promos: ['promo_code'],
          free_sc: ['free_sc'],
          warnings: ['platform_warning'],
          strategy: ['general_tip'],
        };
        if (!(groups[filters.typeFilter] ?? [filters.typeFilter]).includes(item.item_type)) {
          return false;
        }
      }

      if (filters.timeFilter !== 'all') {
        const createdAt = new Date(item.created_at).getTime();
        if (Number.isFinite(createdAt) && now - createdAt > sinceMs) {
          return false;
        }
      }

      return true;
    });
  }, [filters.selectedCasinoIds, filters.timeFilter, filters.typeFilter, items]);

  function setFilters(next: Partial<IntelFilters> | ((current: IntelFilters) => IntelFilters)) {
    startTransition(() => {
      setFilterState((current) => (typeof next === 'function' ? next(current) : { ...current, ...next }));
    });
  }

  return {
    filters,
    setFilters,
    filteredItems,
    trackedCasinos,
    isPending,
  };
}

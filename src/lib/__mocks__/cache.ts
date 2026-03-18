import { vi } from 'vitest';

export const getCached = vi.fn(
  async (_key: string, _ttl: number, fetchFn: () => Promise<any>) => fetchFn(),
);

export const invalidateCached = vi.fn();
export const invalidateCachedPrefix = vi.fn();

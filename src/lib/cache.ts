const cache = new Map<string, { data: unknown; expires: number }>();

export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && cached.expires > now) {
    return cached.data as T;
  }

  const data = await fetchFn();
  cache.set(key, { data, expires: now + ttlMs });
  return data;
}

export function invalidateCached(key: string) {
  cache.delete(key);
}


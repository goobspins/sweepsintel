type RateLimiterOptions = {
  windowMs: number;
  maxRequests: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

export function createRateLimiter({ windowMs, maxRequests }: RateLimiterOptions) {
  const buckets = new Map<string, number[]>();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, timestamps] of buckets.entries()) {
      const recent = timestamps.filter((timestamp) => now - timestamp < windowMs);
      if (recent.length === 0) {
        buckets.delete(key);
        continue;
      }
      buckets.set(key, recent);
    }
  };

  const interval = setInterval(cleanup, 5 * 60 * 1000);
  if (typeof interval === 'object' && typeof interval.unref === 'function') {
    interval.unref();
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const current = buckets.get(key) ?? [];
      const recent = current.filter((timestamp) => now - timestamp < windowMs);

      if (recent.length >= maxRequests) {
        const oldestRelevant = recent[0];
        return {
          allowed: false,
          retryAfterMs: Math.max(0, windowMs - (now - oldestRelevant)),
        };
      }

      recent.push(now);
      buckets.set(key, recent);
      return {
        allowed: true,
        retryAfterMs: 0,
      };
    },
  };
}

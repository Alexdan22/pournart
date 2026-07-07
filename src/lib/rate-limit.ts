type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

const globalForRateLimit = globalThis as unknown as {
  pournartRateLimit?: Map<string, number[]>;
};

const buckets = globalForRateLimit.pournartRateLimit ?? new Map<string, number[]>();

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.pournartRateLimit = buckets;
}

export function rateLimit(key: string, { limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) || []).filter((timestamp) => timestamp > cutoff);

  hits.push(now);
  buckets.set(key, hits);

  return {
    ok: hits.length <= limit,
    remaining: Math.max(0, limit - hits.length),
    resetAt: new Date(now + windowMs),
  };
}

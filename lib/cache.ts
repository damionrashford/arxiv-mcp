const _cache = new Map<string, { v: unknown; exp: number }>();

export const cget = <T>(k: string): T | undefined => {
  const e = _cache.get(k);
  return e && e.exp > Date.now() ? (e.v as T) : undefined;
};

export const cset = (k: string, v: unknown, ttl: number): void => {
  _cache.set(k, { v, exp: Date.now() + ttl });
};

export const cdel = (k: string): void => { _cache.delete(k); };

export const HOUR = 3_600_000;
export const DAY  = 86_400_000;

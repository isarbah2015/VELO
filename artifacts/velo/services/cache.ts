import AsyncStorage from '@react-native-async-storage/async-storage';

// Tiny two-tier cache (in-memory + AsyncStorage) with per-entry TTL. Wraps
// external lookups — geocoding, routing — so repeated queries (popular
// destinations, common routes) don't re-hit the network. This is the single
// biggest lever for cutting external map/geocoding calls.
type Entry<T> = { v: T; exp: number };
const mem = new Map<string, Entry<unknown>>();
const KEY = (k: string) => `velo_cache:${k}`;

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();

  const hit = mem.get(key) as Entry<T> | undefined;
  if (hit && hit.exp > now) return hit.v;

  try {
    const raw = await AsyncStorage.getItem(KEY(key));
    if (raw) {
      const e = JSON.parse(raw) as Entry<T>;
      if (e.exp > now) { mem.set(key, e); return e.v; }
    }
  } catch {
    /* corrupt/absent — fall through to fetch */
  }

  const v = await fetcher();
  const entry: Entry<T> = { v, exp: now + ttlMs };
  mem.set(key, entry);
  AsyncStorage.setItem(KEY(key), JSON.stringify(entry)).catch(() => {});
  return v;
}

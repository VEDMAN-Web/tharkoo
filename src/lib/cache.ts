type Entry = { exp: number; value: unknown };

const store = new Map<string, Entry>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.value as T;
  const value = await fn();
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.exp <= now) store.delete(k);
    }
    if (store.size > 500) store.clear();
  }
  store.set(key, { exp: Date.now() + ttlMs, value });
  return value;
}

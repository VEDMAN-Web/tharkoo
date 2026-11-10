type Entry = { exp: number; value: unknown; tags: string[] };

const store = new Map<string, Entry>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  tags: string[] = [],
): Promise<T> {
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
  store.set(key, { exp: Date.now() + ttlMs, value, tags });
  return value;
}

/** Drop every cached entry that carries one of these tags. */
export function invalidateTags(tags: string[]): void {
  if (tags.length === 0) return;
  const drop = new Set(tags);
  for (const [key, entry] of store) {
    if (entry.tags.some((tag) => drop.has(tag))) store.delete(key);
  }
}

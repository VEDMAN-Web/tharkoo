type Entry = { exp: number; value: unknown; tags: string[] };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const PUBLIC_TAGS = ["site", "categories", "locations", "feed", "listings", "counts"];

function remember(key: string, ttlMs: number, value: unknown, tags: string[]) {
  if (store.size > 20) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.exp <= now) store.delete(k);
    }
    while (store.size > 20) {
      const oldest = store.keys().next().value;
      if (!oldest) break;
      store.delete(oldest);
    }
  }
  store.set(key, { exp: Date.now() + ttlMs, value, tags });
}

async function durableLoad<T>(key: string, ttlMs: number, tags: string[], fn: () => Promise<T>): Promise<T> {
  if (process.env.VITEST) return fn();
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(fn, [key], {
      revalidate: Math.max(30, Math.ceil(ttlMs / 1000)),
      tags,
    })();
  } catch {
    return fn();
  }
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  tags: string[] = [],
  durable = false,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const job = (async () => {
    const value = durable ? await durableLoad(key, ttlMs, tags, fn) : await fn();
    remember(key, ttlMs, value, tags);
    return value;
  })().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, job);
  return job as Promise<T>;
}

/** Drop every cached entry that carries one of these tags. */
export function invalidateTags(tags: string[]): void {
  if (tags.length === 0) return;
  const drop = new Set(tags);
  for (const [key, entry] of store) {
    if (entry.tags.some((tag) => drop.has(tag))) store.delete(key);
  }
}

/** Forget public catalogue caches and ask Next to refresh ISR entries. */
export async function refreshPublicCache() {
  invalidateTags(PUBLIC_TAGS);
  try {
    const { revalidatePath, revalidateTag } = await import("next/cache");
    for (const tag of PUBLIC_TAGS) revalidateTag(tag, { expire: 0 });
    revalidatePath("/", "layout");
  } catch {
    /* scripts and unit tests have no Next request store */
  }
}

type Entry = { exp: number; value: unknown; tags: string[] };

/**
 * One store for the whole server process. Next builds each route (a page, a server action) as its own bundle, and a plain module-level Map
 * would then exist once per bundle: the admin action would clear its own copy and the Home page would keep serving the other.
 */
const shared = globalThis as typeof globalThis & { __tkCacheStore?: Map<string, Entry>; __tkCacheInflight?: Map<string, Promise<unknown>> };
const store = (shared.__tkCacheStore ??= new Map<string, Entry>());
const inflight = (shared.__tkCacheInflight ??= new Map<string, Promise<unknown>>());
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

const loggedPurgeFailures = new Set<string>();
/** What failed to purge, once per caller. Unit tests read this instead of the console. */
export const purgeFailureLog: string[] = [];
const WRAPPER_FRAMES = /purgeNext|reportPurgeFailure|refreshPublicCache|callerFromStack/;

/** The two nearest function names outside this file, for the log line: "setMoneySettings < settingsAction". */
function callerFromStack(): string {
  const names: string[] = [];
  for (const line of (new Error().stack ?? "").split(/\r?\n/).slice(1)) {
    const match = /at (?:async )?([^\s(]+) \(/.exec(line);
    if (!match || WRAPPER_FRAMES.test(match[1]) || line.includes("node:internal")) continue;
    names.push(match[1]);
    if (names.length === 2) break;
  }
  return names.join(" < ") || "unknown caller";
}

function reportPurgeFailure(caller: string | undefined, error: unknown) {
  const who = caller || callerFromStack();
  if (loggedPurgeFailures.has(who)) return;
  loggedPurgeFailures.add(who);
  const message = error instanceof Error ? error.message : String(error);
  const line = `public purge did not run (${who}): ${message}. Public pages may stay old until their timer ends.`;
  purgeFailureLog.push(line);
  if (!process.env.VITEST) console.error(line);
}

export type PurgeTarget = { tags?: readonly string[]; paths?: readonly (string | readonly [string, "layout" | "page"])[]; caller?: string };

/**
 * Asks Next to expire cached tags and pages. This works inside a request (a server action or a route handler). Outside one (a
 * script, a start-up task) Next throws; that is reported once per caller instead of being swallowed, and the function returns false.
 */
export async function purgeNext(target: PurgeTarget): Promise<boolean> {
  try {
    const { revalidatePath, revalidateTag } = await import("next/cache");
    for (const tag of target.tags ?? []) revalidateTag(tag, { expire: 0 });
    for (const path of target.paths ?? []) {
      if (typeof path === "string") revalidatePath(path);
      else revalidatePath(path[0], path[1]);
    }
    return true;
  } catch (error) {
    reportPurgeFailure(target.caller, error);
    return false;
  }
}

/** Forget public catalogue caches and ask Next to refresh ISR entries. */
export async function refreshPublicCache(caller?: string) {
  invalidateTags(PUBLIC_TAGS);
  await purgeNext({ tags: PUBLIC_TAGS, paths: [["/", "layout"]], caller });
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function allowRequest(key: string, max: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 8000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
    if (buckets.size > 8000) buckets.clear();
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

export function clientKey(headers: Headers) {
  // Use the LAST entry: our own Nginx appends the real client IP. The first entry is client-controlled.
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  return forwarded || headers.get("x-real-ip") || "local";
}

export type LimitBucket = "search" | "page" | "bot" | "api";

const BOT_USER_AGENT = /Googlebot|bingbot|DuckDuckBot|YandexBot|Applebot|OAI-SearchBot|PerplexityBot|Claude-SearchBot/i;

export function limitBucket(path: string, method: string, userAgent: string): { bucket: LimitBucket; envName: string; fallback: number } {
  if (path.startsWith("/search") || path.startsWith("/api/catalog")) {
    return { bucket: "search", envName: "SEARCH_RATE_MAX", fallback: 30 };
  }
  if (path.startsWith("/api/") || (method !== "GET" && method !== "HEAD")) {
    return { bucket: "api", envName: "SITE_RATE_MAX", fallback: 240 };
  }
  if (BOT_USER_AGENT.test(userAgent)) {
    return { bucket: "bot", envName: "BOT_RATE_MAX", fallback: 1200 };
  }
  return { bucket: "page", envName: "SITE_RATE_MAX", fallback: 240 };
}

import { connectDb } from "@/lib/db";
import { MAX_404_PATHS_PER_DAY, NotFoundDay } from "@/server/models/seo";

const SKIP_PREFIXES = ["/_next/", "/admin", "/api/", "/u/"];
const ASSET_EXT = /\.(?:js|mjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|txt|xml|json|webmanifest|mp4|webm|pdf)$/i;
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|ahrefs|semrush|mj12|dotbot|petalbot|yandex|baidu|duckduck/i;
const MAX_PATH = 300;

/** Only real page addresses are worth counting. */
export function shouldLog(path: string) {
  if (!path.startsWith("/") || path.length > MAX_PATH) return false;
  if (SKIP_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix))) return false;
  if (path === "/favicon.ico" || path === "/robots.txt") return false;
  return !ASSET_EXT.test(path);
}

export function isBot(userAgent: string | null | undefined) {
  return BOT_UA.test(userAgent ?? "");
}

export function refDomainOf(referer: string | null | undefined) {
  if (!referer) return "";
  try {
    return new URL(referer).hostname.toLowerCase().slice(0, 120);
  } catch {
    return "";
  }
}

export function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export interface NotFoundHit {
  path: string;
  userAgent?: string | null;
  referer?: string | null;
  now?: Date;
}

/**
 * Counts one 404. One update per known path and day; a new path costs one count and one insert.
 * Never throws: logging must not break the 404 page.
 */
export async function logNotFound(hit: NotFoundHit) {
  try {
    const path = hit.path.split("?")[0].split("#")[0];
    if (!shouldLog(path)) return false;
    await connectDb();
    const day = dayKey(hit.now ?? new Date());
    const inc = { hits: 1, botHits: isBot(hit.userAgent) ? 1 : 0 };
    const refDomain = refDomainOf(hit.referer);
    const set = refDomain ? { refDomain } : {};
    const known = await NotFoundDay.updateOne({ day, path }, { $inc: inc, $set: set });
    if (known.matchedCount > 0) return true;
    if ((await NotFoundDay.countDocuments({ day })) >= MAX_404_PATHS_PER_DAY) return false;
    await NotFoundDay.updateOne({ day, path }, { $inc: inc, $set: set }, { upsert: true });
    return true;
  } catch (error) {
    console.error("404 log failed", error);
    return false;
  }
}

export interface NotFoundRow {
  path: string;
  hits: number;
  botHits: number;
  humanHits: number;
  refDomain: string;
  lastDay: string;
}

/** Hits per path over the last `days` days, busiest first. */
export async function listNotFound(days = 7, now = new Date()): Promise<NotFoundRow[]> {
  await connectDb();
  const since = dayKey(new Date(now.getTime() - (days - 1) * 86_400_000));
  const rows = await NotFoundDay.aggregate<{ _id: string; hits: number; botHits: number; refDomain: string; lastDay: string }>([
    { $match: { day: { $gte: since } } },
    { $sort: { day: 1 } },
    {
      $group: {
        _id: "$path",
        hits: { $sum: "$hits" },
        botHits: { $sum: "$botHits" },
        refDomain: { $last: "$refDomain" },
        lastDay: { $max: "$day" },
      },
    },
    { $sort: { hits: -1, _id: 1 } },
    { $limit: 500 },
  ]);
  return rows.map((row) => ({
    path: row._id,
    hits: row.hits,
    botHits: row.botHits,
    humanHits: row.hits - row.botHits,
    refDomain: row.refDomain || "",
    lastDay: row.lastDay,
  }));
}

export async function total404Hits(days = 7, now = new Date()) {
  const rows = await listNotFound(days, now);
  return rows.reduce((sum, row) => sum + row.hits, 0);
}

import { connectDb } from "@/lib/db";
import { Listing } from "@/server/models";
import { cleanQuery, escapeRegExp, loadCategories } from "@/server/search/query";
import { loadLocations } from "@/server/locations/service";

export type Suggestion = { kind: "category" | "city" | "ad"; label: string; value: string };

export const MAX_SUGGESTIONS = 6;
const MIN_LENGTH = 2;

export async function suggestSearch(raw: string): Promise<Suggestion[]> {
  const text = cleanQuery(raw).slice(0, 40).trim();
  if (text.length < MIN_LENGTH) return [];
  const lower = text.toLowerCase();
  const [categories, locations] = await Promise.all([loadCategories(), loadLocations()]);
  const found: Suggestion[] = [];
  for (const row of categories) {
    if (row.enabled !== false && row.name && row.name.toLowerCase().includes(lower)) found.push({ kind: "category", label: row.name, value: row.slug });
  }
  for (const row of locations) {
    if (row.type === "city" && row.enabled !== false && row.name.toLowerCase().includes(lower)) found.push({ kind: "city", label: row.name, value: row.slug });
  }
  const places = found.slice(0, 4);
  await connectDb();
  const rows = await Listing.find({ status: "active", title: { $regex: `(^| )${escapeRegExp(text)}`, $options: "i" } })
    .select("title")
    .sort({ publishedAt: -1 })
    .limit(40)
    .lean<{ title?: string }[]>();
  const seen = new Set<string>();
  const ads: Suggestion[] = [];
  for (const row of rows) {
    const title = (row.title || "").trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    ads.push({ kind: "ad", label: title, value: title });
  }
  const room = MAX_SUGGESTIONS - places.length;
  return [...places, ...ads.slice(0, Math.max(room, MAX_SUGGESTIONS - 4))].slice(0, MAX_SUGGESTIONS);
}

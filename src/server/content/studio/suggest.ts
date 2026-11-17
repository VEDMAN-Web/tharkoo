import { connectDb } from "@/lib/db";
import { getCategories, getCities } from "@/lib/queries";
import { categoryPath, placePath } from "@/lib/urls";
import { Listing } from "@/server/models";
import { getIndexing, hubMinimum, isCategoryOn } from "@/server/seo/indexing";

/**
 * H8.31: internal link suggestions for the editor. Only pages Google can see are suggested: the same rule as the sitemap
 * (the category or the category in a city has at least its minimum of live ads, and is not switched off in Indexing rules).
 */

export type LinkCandidate = { label: string; path: string; ads: number; terms: string[] };
export type LinkSuggestion = { phrase: string; label: string; path: string; ads: number };

const MAX_SUGGESTIONS = 5;
const MAX_TEXT = 20_000;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The first match of a word or phrase in the text, as it is written there (whole words, any case). */
export function findPhrase(text: string, term: string): string | null {
  const clean = term.trim();
  if (clean.length < 3) return null;
  const match = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(clean)})(?![\\p{L}\\p{N}])`, "iu").exec(text);
  return match ? match[2] : null;
}

/** Paths the text already links to, so the same page is not suggested twice. */
export function linkedPaths(text: string): Set<string> {
  return new Set([...text.matchAll(/\]\((\/[^)\s]*)\)/g)].map((match) => match[1]));
}

/**
 * Picks at most five pages for the words found in the text. A page that matches two of its words ranks above one that matches one,
 * then the page with more ads. Each written phrase gets one page, and a page is suggested once.
 */
export function pickSuggestions(text: string, candidates: readonly LinkCandidate[], limit = MAX_SUGGESTIONS): LinkSuggestion[] {
  const already = linkedPaths(text);
  const scored: { candidate: LinkCandidate; phrase: string; hits: number }[] = [];
  for (const candidate of candidates) {
    if (already.has(candidate.path)) continue;
    const found = candidate.terms.map((term) => findPhrase(text, term)).filter((value): value is string => value !== null);
    if (found.length === 0) continue;
    scored.push({ candidate, phrase: found[0], hits: found.length });
  }
  scored.sort((a, b) => b.hits - a.hits || b.candidate.ads - a.candidate.ads || a.candidate.path.localeCompare(b.candidate.path));
  const phrases = new Set<string>();
  const out: LinkSuggestion[] = [];
  for (const row of scored) {
    const key = row.phrase.toLowerCase();
    if (phrases.has(key)) continue;
    phrases.add(key);
    out.push({ phrase: row.phrase, label: row.candidate.label, path: row.candidate.path, ads: row.candidate.ads });
    if (out.length >= limit) break;
  }
  return out;
}

type Counted = { _id: { categoryId: string; cityId: string }; n: number };

/** Every page Google can see right now, with its live ad count. */
export async function indexableCandidates(): Promise<LinkCandidate[]> {
  await connectDb();
  const [categories, cities, counted, indexing] = await Promise.all([
    getCategories(),
    getCities(),
    Listing.aggregate<Counted>([
      { $match: { status: "active", feedHidden: { $ne: true }, $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }] } },
      { $group: { _id: { categoryId: { $toString: "$categoryId" }, cityId: { $toString: "$cityId" } }, n: { $sum: 1 } } },
    ]),
    getIndexing(),
  ]);
  const categoryById = new Map(categories.filter((category) => category.slug).map((category) => [String(category._id), category]));
  const cityById = new Map(cities.map((city) => [city.id, city]));
  const totals = new Map<string, number>();
  const out: LinkCandidate[] = [];
  for (const row of counted) {
    const category = categoryById.get(row._id.categoryId);
    const city = cityById.get(row._id.cityId);
    if (!category?.slug || !city?.slug) continue;
    totals.set(row._id.categoryId, (totals.get(row._id.categoryId) ?? 0) + row.n);
    if (row.n >= hubMinimum(indexing, category, city.slug)) {
      out.push({ label: `${category.name} in ${city.name}`, path: placePath(category.slug, city.slug), ads: row.n, terms: [city.name, category.name] });
    }
  }
  for (const [id, total] of totals) {
    const category = categoryById.get(id);
    if (!category?.slug || !isCategoryOn(indexing, category.slug) || total < hubMinimum(indexing, category)) continue;
    out.push({ label: category.name, path: categoryPath(category.slug), ads: total, terms: [category.name] });
  }
  return out;
}

/** Suggestions for the words in an article body. Returns nothing for very short text. */
export async function suggestLinks(text: string): Promise<LinkSuggestion[]> {
  await connectDb();
  const body = String(text ?? "").slice(0, MAX_TEXT);
  if (body.trim().length < 20) return [];
  return pickSuggestions(body, await indexableCandidates());
}

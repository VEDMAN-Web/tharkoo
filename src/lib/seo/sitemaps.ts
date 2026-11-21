import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { getBlogPosts, getCategories, getCities, getHelpArticles, getStates } from "@/lib/queries";
import { siteUrl } from "@/lib/utils";
import { adPath, blogPath, categoriesPath, categoryPath, citiesPath, cmsPath, contactPath, helpPath, howItWorksPath, joinPath, placePath, prohibitedPath, safetyPath } from "@/lib/urls";
import { Category, Listing, Location, Page } from "@/server/models";
import { getPaths } from "@/server/urls/service";
import { subcategorySitemapEntries } from "@/server/seo/subcategory-sitemap";
import { isCityAlias } from "@/lib/seo/district-alias";
import { addressesFor } from "@/server/listings/ad-code";
import { demoOwnerId, DEMO_SLUG } from "@/server/listings/demo-ads";
import { notSampleClause } from "@/server/seo/real-ads";
import { getIndexing, isCategoryOn, isCityOn } from "@/server/seo/indexing";

/** Listing shards hold only the three indexable page types (category, category+city, category+city+area). */
export const SITEMAP_SHARDS = ["categories", "cities", "districts", "ads", "content"] as const;
export type SitemapShard = (typeof SITEMAP_SHARDS)[number];

const AD_SITEMAP_MAX = 50_000;

/** H17.2: lastmod is the record's real date. A page with no real date has none: it is left out, never made up. */
export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

function origin() {
  return siteUrl().replace(/\/$/, "");
}

function loc(path: string) {
  return `${origin()}${path.startsWith("/") ? path : `/${path}`}`;
}

function stamp(value?: Date | string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** The newest of several real dates, or undefined when there is none. */
function newest(...values: (Date | string | null | undefined)[]): string | undefined {
  const times = values.map((value) => (value ? new Date(value).getTime() : NaN)).filter((time) => !Number.isNaN(time));
  return times.length ? new Date(Math.max(...times)).toISOString() : undefined;
}

export function isShard(value: string): value is SitemapShard {
  return (SITEMAP_SHARDS as readonly string[]).includes(value);
}

export function sitemapXml(entries: SitemapEntry[]) {
  const unique = new Map<string, SitemapEntry>();
  for (const entry of entries) unique.set(entry.loc, entry);
  const body = [...unique.values()]
    .map((entry) => `<url><loc>${entry.loc}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}</url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function sitemapIndexXml(shards: SitemapShard[]) {
  const body = shards
    .map((shard) => `<sitemap><loc>${loc(`/sitemap/${shard}.xml`)}</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

export async function shardEntries(shard: SitemapShard): Promise<SitemapEntry[]> {
  await connectDb();
  const paths = await getPaths();
  if (shard === "content") {
    const [posts, articles, pages] = await Promise.all([
      getBlogPosts(),
      getHelpArticles(),
      Page.find({ status: "published" }).select("slug updatedAt").lean(),
    ]);
    // The fixed pages have no record that keeps a date, so they carry no lastmod.
    const urls: SitemapEntry[] = ["/", citiesPath(paths), blogPath(paths), helpPath(paths), contactPath(paths), "/terms/", "/privacy/", "/cookies/", "/scam-report/", categoriesPath(), safetyPath(), howItWorksPath(), prohibitedPath()].map((path) => ({ loc: loc(path) }));
    for (const post of posts) if (post.slug) urls.push({ loc: loc(blogPath(paths, post.slug)), lastmod: stamp(post.updatedAt) });
    for (const article of articles) if (article.slug) urls.push({ loc: loc(helpPath(paths, article.slug)), lastmod: stamp(article.updatedAt) });
    for (const page of pages) if (page.slug) urls.push({ loc: loc(cmsPath(paths, page.slug)), lastmod: stamp(page.updatedAt) });
    const seen = new Set<string>();
    return urls.filter((entry) => {
      if (seen.has(entry.loc)) return false;
      seen.add(entry.loc);
      return true;
    });
  }
  const liveMatch = {
    status: "active" as const,
    feedHidden: { $ne: true },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };
  if (shard === "categories" || shard === "cities" || shard === "districts") {
    // H18.2 (21 Nov 2026): only listing pages with at least one REAL live ad are in the sitemap (sample ads do not count),
    // matching the page's own robots tag. The Indexing rules switches still leave a page out. Category pages stay listed.
    const notSample = await notSampleClause();
    const [categories, cities, states, counted, districtDocs, categoryDocs] = await Promise.all([
      getCategories(),
      getCities(),
      getStates().catch(() => []),
      Listing.aggregate<{ _id: { categoryId: string; cityId: string; stateId: string; districtId: string }; last: Date | null }>([
        { $match: { $and: [liveMatch, ...notSample] } },
        {
          $group: {
            _id: {
              categoryId: { $toString: "$categoryId" },
              cityId: { $toString: "$cityId" },
              stateId: { $toString: "$stateId" },
              districtId: { $toString: "$districtId" },
            },
            last: { $max: { $ifNull: ["$updatedAt", "$publishedAt"] } },
          },
        },
      ]),
      Location.find({ type: { $in: ["state", "city", "district"] } }).select("slug type parentId enabled updatedAt").lean<{ slug?: string; type: string; parentId?: unknown; enabled?: boolean; updatedAt?: Date }[]>(),
      Category.find().select("slug updatedAt").lean<{ slug?: string; updatedAt?: Date }[]>(),
    ]);
    const placeDate = new Map(districtDocs.filter((row) => row.slug).map((row) => [`${row.type}:${row.slug}`, row.updatedAt]));
    const categoryDate = new Map(categoryDocs.filter((row) => row.slug).map((row) => [row.slug as string, row.updatedAt]));
    const indexing = await getIndexing();
    const cats = categories.filter((cat) => cat.slug && isCategoryOn(indexing, cat.slug));
    const onCities = cities.filter((city) => city.slug && isCityOn(indexing, city.slug));
    const lastBy = new Map<string, Date | null>();
    const realState = new Set<string>();
    const realCity = new Set<string>();
    const realDistrict = new Set<string>();
    for (const row of counted) {
      const key = `${row._id.categoryId}|${row._id.cityId}`;
      const before = lastBy.get(key);
      lastBy.set(key, before && row.last && before > row.last ? before : row.last);
      realState.add(`${row._id.categoryId}|${row._id.stateId}`);
      realCity.add(row._id.cityId);
      realDistrict.add(`${row._id.categoryId}|${row._id.cityId}|${row._id.districtId}`);
    }
    const urls: SitemapEntry[] = [];
    if (shard === "categories") {
      for (const cat of cats) urls.push({ loc: loc(categoryPath(cat.slug!)), lastmod: stamp(categoryDate.get(cat.slug!)) });
      return urls;
    }
    if (shard === "cities") {
      for (const cat of cats) {
        for (const state of states) if (state.slug && realState.has(`${String(cat._id)}|${String((state as { id?: unknown; _id?: unknown }).id ?? (state as { _id?: unknown })._id)}`)) urls.push({ loc: loc(placePath(cat.slug!, state.slug)), lastmod: newest(placeDate.get(`state:${state.slug}`), categoryDate.get(cat.slug!)) });
        for (const city of onCities) if (lastBy.has(`${String(cat._id)}|${city.id}`)) urls.push({ loc: loc(placePath(cat.slug!, city.slug!)), lastmod: newest(placeDate.get(`city:${city.slug}`), categoryDate.get(cat.slug!), lastBy.get(`${String(cat._id)}|${city.id}`)) });
      }
      for (const city of onCities) if (realCity.has(String(city.id))) urls.push({ loc: loc(joinPath(citiesPath(paths), city.slug)), lastmod: stamp(placeDate.get(`city:${city.slug}`)) });
      return urls;
    }
    const cityById = new Map(onCities.map((city) => [city.id, city]));
    for (const row of districtDocs.filter((place) => place.type === "district")) {
      const city = cityById.get(String(row.parentId));
      if (!city?.slug || !row.slug || row.enabled === false || isCityAlias(city.slug, row.slug)) continue;
      for (const cat of cats) {
        if (!realDistrict.has(`${String(cat._id)}|${city.id}|${String((row as { _id?: unknown })._id)}`)) continue;
        urls.push({ loc: loc(placePath(cat.slug!, city.slug, row.slug)), lastmod: newest(row.updatedAt, categoryDate.get(cat.slug!), lastBy.get(`${String(cat._id)}|${city.id}`)) });
      }
    }
    for (const entry of await subcategorySitemapEntries(loc)) urls.push({ loc: entry.loc, lastmod: entry.lastmod });
    return urls;
  }
  // H17.8: the ads shard lists every live REAL ad that is set to be indexed. Sample (demo) ads are never listed; with none, the shard is empty and still valid. At most 50,000 (the sitemap limit).
  const seedOwner = await demoOwnerId();
  const notSample = seedOwner ? [{ $nor: [{ ownerId: seedOwner, slug: { $regex: DEMO_SLUG.source } }] }] : [];
  const ads = await Listing.find({ $and: [liveMatch, { seoNoindex: false }, ...notSample] })
    .select("slug updatedAt publishedAt title categoryId cityId code")
    .sort({ _id: 1 })
    .limit(AD_SITEMAP_MAX)
    .lean<{ _id: unknown; slug?: string; updatedAt?: Date; publishedAt?: Date; title?: string; categoryId?: Types.ObjectId; cityId?: Types.ObjectId; code?: string }[]>();
  // H16.2: each ad is listed at its own address (/<category>/<city>/<title>-<code>/); an ad that has no code yet keeps its old link, which forwards.
  const addresses = await addressesFor(ads);
  return ads
    .filter((ad) => ad.slug)
    .map((ad) => ({ loc: loc(addresses.get(String(ad._id)) ?? adPath(paths, ad.slug!)), lastmod: stamp(ad.updatedAt ?? ad.publishedAt) }));
}

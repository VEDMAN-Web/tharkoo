import { connectDb } from "@/lib/db";
import { getBlogPosts, getCategories, getCities, getHelpArticles, getStates } from "@/lib/queries";
import { siteUrl } from "@/lib/utils";
import { adPath, blogPath, categoriesPath, categoryPath, citiesPath, cmsPath, contactPath, helpPath, howItWorksPath, joinPath, placePath, prohibitedPath, safetyPath } from "@/lib/urls";
import { Listing, Location, Page } from "@/server/models";
import { getPaths } from "@/server/urls/service";
import { subcategorySitemapEntries } from "@/server/seo/subcategory-sitemap";
import { isCityAlias } from "@/lib/seo/district-alias";
import { demoOwnerId, DEMO_SLUG } from "@/server/listings/demo-ads";
import { getIndexing, isCategoryOn, isCityOn } from "@/server/seo/indexing";

/** Listing shards hold only the three indexable page types (category, category+city, category+city+area). */
export const SITEMAP_SHARDS = ["categories", "cities", "districts", "ads", "content"] as const;
export type SitemapShard = (typeof SITEMAP_SHARDS)[number];

const AD_SITEMAP_MAX = 50_000;

export interface SitemapEntry {
  loc: string;
  lastmod: string;
}

function origin() {
  return siteUrl().replace(/\/$/, "");
}

function loc(path: string) {
  return `${origin()}${path.startsWith("/") ? path : `/${path}`}`;
}

function stamp(value?: Date | string | null) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function isShard(value: string): value is SitemapShard {
  return (SITEMAP_SHARDS as readonly string[]).includes(value);
}

export function sitemapXml(entries: SitemapEntry[]) {
  const unique = new Map<string, SitemapEntry>();
  for (const entry of entries) unique.set(entry.loc, entry);
  const body = [...unique.values()]
    .map((entry) => `<url><loc>${entry.loc}</loc><lastmod>${entry.lastmod}</lastmod></url>`)
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
  const now = new Date().toISOString();
  if (shard === "content") {
    const [posts, articles, pages] = await Promise.all([
      getBlogPosts(),
      getHelpArticles(),
      Page.find({ status: "published" }).select("slug updatedAt").lean(),
    ]);
    const urls: SitemapEntry[] = [
      ["/", now],
      [citiesPath(paths), now],
      [blogPath(paths), now],
      [helpPath(paths), now],
      [contactPath(paths), now],
      ["/terms/", now],
      ["/privacy/", now],
      ["/cookies/", now],
      ["/scam-report/", now],
      [categoriesPath(), now],
      [safetyPath(), now],
      [howItWorksPath(), now],
      [prohibitedPath(), now],
    ].map(([path, lastmod]) => ({ loc: loc(path), lastmod }));
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
    // H16.5: every public listing page is in the sitemap, even with sample ads or none yet. Only the Indexing rules switches leave one out.
    const [categories, cities, states, counted, districtDocs] = await Promise.all([
      getCategories(),
      getCities(),
      getStates().catch(() => []),
      Listing.aggregate<{ _id: { categoryId: string; cityId: string }; last: Date | null }>([
        { $match: liveMatch },
        {
          $group: {
            _id: { categoryId: { $toString: "$categoryId" }, cityId: { $toString: "$cityId" } },
            last: { $max: { $ifNull: ["$updatedAt", "$publishedAt"] } },
          },
        },
      ]),
      Location.find({ type: "district" }).select("slug parentId enabled").lean(),
    ]);
    const indexing = await getIndexing();
    const cats = categories.filter((cat) => cat.slug && isCategoryOn(indexing, cat.slug));
    const onCities = cities.filter((city) => city.slug && isCityOn(indexing, city.slug));
    const lastBy = new Map<string, Date | null>();
    for (const row of counted) lastBy.set(`${row._id.categoryId}|${row._id.cityId}`, row.last);
    const urls: SitemapEntry[] = [];
    if (shard === "categories") {
      for (const cat of cats) urls.push({ loc: loc(categoryPath(cat.slug!)), lastmod: now });
      return urls;
    }
    if (shard === "cities") {
      for (const cat of cats) {
        for (const state of states) if (state.slug) urls.push({ loc: loc(placePath(cat.slug!, state.slug)), lastmod: now });
        for (const city of onCities) urls.push({ loc: loc(placePath(cat.slug!, city.slug!)), lastmod: stamp(lastBy.get(`${String(cat._id)}|${city.id}`)) });
      }
      for (const city of onCities) urls.push({ loc: loc(joinPath(citiesPath(paths), city.slug)), lastmod: now });
      return urls;
    }
    const cityById = new Map(onCities.map((city) => [city.id, city]));
    for (const row of districtDocs) {
      const city = cityById.get(String(row.parentId));
      if (!city?.slug || !row.slug || row.enabled === false || isCityAlias(city.slug, row.slug)) continue;
      for (const cat of cats) urls.push({ loc: loc(placePath(cat.slug!, city.slug, row.slug)), lastmod: stamp(lastBy.get(`${String(cat._id)}|${city.id}`)) });
    }
    for (const entry of await subcategorySitemapEntries(loc)) urls.push({ loc: entry.loc, lastmod: entry.lastmod ?? stamp() });
    return urls;
  }
  // H16.5: the ads shard lists every live ad that is set to be indexed, and every live sample (demo) ad. At most 50,000 (the sitemap limit).
  const seedOwner = await demoOwnerId();
  const indexable = [{ seoNoindex: false }, ...(seedOwner ? [{ ownerId: seedOwner, slug: { $regex: DEMO_SLUG.source } }] : [])];
  const ads = await Listing.find({ $and: [liveMatch, { $or: indexable }] })
    .select("slug updatedAt publishedAt")
    .sort({ _id: 1 })
    .limit(AD_SITEMAP_MAX)
    .lean<{ slug?: string; updatedAt?: Date; publishedAt?: Date }[]>();
  return ads.filter((ad) => ad.slug).map((ad) => ({ loc: loc(adPath(paths, ad.slug!)), lastmod: stamp(ad.updatedAt ?? ad.publishedAt) }));
}

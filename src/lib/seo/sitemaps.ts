import { connectDb } from "@/lib/db";
import { getBlogPosts, getCategories, getCities, getHelpArticles } from "@/lib/queries";
import { siteUrl } from "@/lib/utils";
import { adPath, blogPath, categoriesPath, categoryPath, citiesPath, cmsPath, contactPath, helpPath, howItWorksPath, placePath, prohibitedPath, safetyPath, tagPath } from "@/lib/urls";
import { Listing, Location, Page } from "@/server/models";
import { getPaths, publicTags } from "@/server/urls/service";

export const SITEMAP_SHARDS = ["categories", "cities", "districts", "tags", "ads", "content"] as const;
export type SitemapShard = (typeof SITEMAP_SHARDS)[number];

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
  const body = entries
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
      [cmsPath(paths, "about"), now],
      [cmsPath(paths, "grievance"), now],
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
    return urls;
  }
  const liveMatch = {
    status: "active" as const,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };
  if (shard === "categories" || shard === "cities" || shard === "districts") {
    const [categories, cities, counted, districtDocs] = await Promise.all([
      getCategories(),
      getCities(),
      Listing.aggregate<{ _id: { categoryId: string; cityId: string; districtId: string }; n: number; last: Date | null }>([
        { $match: liveMatch },
        {
          $group: {
            _id: {
              categoryId: { $toString: "$categoryId" },
              cityId: { $toString: "$cityId" },
              districtId: { $ifNull: [{ $toString: "$districtId" }, ""] },
            },
            n: { $sum: 1 },
            last: { $max: { $ifNull: ["$updatedAt", "$publishedAt"] } },
          },
        },
      ]),
      Location.find({ type: "district" }).select("slug").lean(),
    ]);
    const citySlug = new Map(cities.map((city) => [city.id, city.slug]));
    const districtSlug = new Map(districtDocs.map((row) => [String(row._id), row.slug || ""]));
    const categoryById = new Map(categories.filter((cat) => cat.slug).map((cat) => [String(cat._id), cat]));
    if (shard === "categories") {
      const totals = new Map<string, { n: number; last: Date | null }>();
      for (const row of counted) {
        const current = totals.get(row._id.categoryId) || { n: 0, last: null };
        current.n += row.n;
        if (row.last && (!current.last || row.last > current.last)) current.last = row.last;
        totals.set(row._id.categoryId, current);
      }
      return [...categoryById.entries()].flatMap(([id, cat]) => {
        const total = totals.get(id);
        if (!total || total.n < (cat.minListingsIndex ?? 3) || !cat.slug) return [];
        return [{ loc: loc(categoryPath(cat.slug)), lastmod: stamp(total.last) }];
      });
    }
    const urls: SitemapEntry[] = [];
    const rolled = new Map<string, { n: number; last: Date | null; category: string; city: string }>();
    for (const row of counted) {
      const cat = categoryById.get(row._id.categoryId);
      const city = citySlug.get(row._id.cityId);
      if (!cat?.slug || !city) continue;
      if (shard === "districts" && row._id.districtId) {
        const district = districtSlug.get(row._id.districtId);
        if (district && row.n >= (cat.minListingsLocality ?? 10)) {
          urls.push({ loc: loc(placePath(cat.slug, city, district)), lastmod: stamp(row.last) });
        }
      }
      const key = `${cat.slug}|${city}`;
      const current = rolled.get(key) || { n: 0, last: null, category: cat.slug, city };
      current.n += row.n;
      if (row.last && (!current.last || row.last > current.last)) current.last = row.last;
      rolled.set(key, current);
    }
    if (shard === "cities") {
      for (const row of rolled.values()) {
        const cat = categories.find((item) => item.slug === row.category);
        if (row.n >= (cat?.minListingsIndex ?? 3)) urls.push({ loc: loc(placePath(row.category, row.city)), lastmod: stamp(row.last) });
      }
    }
    return urls;
  }
  if (shard === "tags") {
    const [categories, tags, used] = await Promise.all([
      getCategories(),
      publicTags(),
      Listing.distinct("attributes.tag", { ...liveMatch, seoNoindex: { $ne: true }, "attributes.tag": { $type: "string" } }),
    ]);
    const live = new Set(used.map((tag) => String(tag)));
    const urls: SitemapEntry[] = [];
    for (const cat of categories) {
      if (!cat.slug) continue;
      for (const tag of tags) {
        if (!live.has(tag.slug)) continue;
        urls.push({ loc: loc(tagPath(paths, cat.slug, tag.slug)), lastmod: now });
      }
    }
    return urls;
  }
  const ads = await Listing.find({ ...liveMatch, seoNoindex: { $ne: true }, slug: { $exists: true } })
    .select("slug updatedAt publishedAt")
    .lean();
  return ads
    .filter((ad) => ad.slug)
    .map((ad) => ({ loc: loc(adPath(paths, ad.slug!)), lastmod: stamp(ad.updatedAt || ad.publishedAt) }));
}

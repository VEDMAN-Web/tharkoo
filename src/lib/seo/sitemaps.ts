import { connectDb } from "@/lib/db";
import { getBlogPosts, getCategories, getCities, getDistricts, getHelpArticles } from "@/lib/queries";
import { siteUrl } from "@/lib/utils";
import { adPath, blogPath, categoryPath, citiesPath, cmsPath, contactPath, helpPath, placePath, tagPath } from "@/lib/urls";
import { Listing, Page } from "@/server/models";
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
    ].map(([path, lastmod]) => ({ loc: loc(path), lastmod }));
    for (const post of posts) if (post.slug) urls.push({ loc: loc(blogPath(paths, post.slug)), lastmod: stamp(post.updatedAt) });
    for (const article of articles) if (article.slug) urls.push({ loc: loc(helpPath(paths, article.slug)), lastmod: stamp(article.updatedAt) });
    for (const page of pages) if (page.slug) urls.push({ loc: loc(cmsPath(paths, page.slug)), lastmod: stamp(page.updatedAt) });
    return urls;
  }
  if (shard === "categories") {
    const categories = await getCategories();
    return categories.filter((cat) => cat.slug).map((cat) => ({ loc: loc(categoryPath(cat.slug!)), lastmod: now }));
  }
  if (shard === "cities") {
    const [categories, cities] = await Promise.all([getCategories(), getCities()]);
    const urls: SitemapEntry[] = [];
    for (const cat of categories) {
      if (!cat.slug) continue;
      for (const city of cities) {
        if (city.slug) urls.push({ loc: loc(placePath(cat.slug, city.slug)), lastmod: now });
      }
    }
    return urls;
  }
  if (shard === "districts") {
    const [categories, cities] = await Promise.all([getCategories(), getCities()]);
    const groups = await Promise.all(
      cities.filter((city) => city.slug).map(async (city) => ({ slug: city.slug!, rows: await getDistricts(city.slug!) })),
    );
    const urls: SitemapEntry[] = [];
    for (const cat of categories) {
      if (!cat.slug) continue;
      for (const group of groups) {
        for (const district of group.rows) {
          if (district.slug) urls.push({ loc: loc(placePath(cat.slug, group.slug, district.slug)), lastmod: now });
        }
      }
    }
    return urls;
  }
  if (shard === "tags") {
    const [categories, tags, used] = await Promise.all([
      getCategories(),
      publicTags(),
      Listing.distinct("attributes.tag", { status: "active", "attributes.tag": { $type: "string" } }),
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
  const ads = await Listing.find({ status: "active", slug: { $exists: true } }).select("slug updatedAt publishedAt").lean();
  return ads
    .filter((ad) => ad.slug)
    .map((ad) => ({ loc: loc(adPath(paths, ad.slug!)), lastmod: stamp(ad.updatedAt || ad.publishedAt) }));
}

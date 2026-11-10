import { connectDb } from "@/lib/db";
import { getBlogPosts, getCategories, getCities, getDistricts, getHelpArticles } from "@/lib/queries";
import { siteUrl } from "@/lib/utils";
import { TAG_PAGES } from "@/data/catalog";
import { Listing, Page, Site } from "@/server/models";

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

async function extraTags() {
  const site = (await Site.findOne({ key: "default" }).select("tags").lean()) as { tags?: { slug?: string; label?: string }[] } | null;
  const rows = Array.isArray(site?.tags) ? site.tags : [];
  return rows
    .map((row) => {
      const item = row as { slug?: string; label?: string };
      return item.slug ? { slug: item.slug, label: item.label || item.slug } : null;
    })
    .filter((row): row is { slug: string; label: string } => Boolean(row));
}

export async function shardEntries(shard: SitemapShard): Promise<SitemapEntry[]> {
  await connectDb();
  const now = new Date().toISOString();
  if (shard === "content") {
    const [posts, articles, pages] = await Promise.all([
      getBlogPosts(),
      getHelpArticles(),
      Page.find({ status: "published" }).select("slug updatedAt").lean(),
    ]);
    const urls: SitemapEntry[] = [
      ["/", now],
      ["/cities/", now],
      ["/blog/", now],
      ["/help/", now],
      ["/contact/", now],
      ["/cms/about/", now],
      ["/cms/grievance/", now],
      ["/terms/", now],
      ["/privacy/", now],
      ["/cookies/", now],
      ["/scam-report/", now],
    ].map(([path, lastmod]) => ({ loc: loc(path), lastmod }));
    for (const post of posts) if (post.slug) urls.push({ loc: loc(`/blog/${post.slug}/`), lastmod: stamp(post.updatedAt) });
    for (const article of articles) if (article.slug) urls.push({ loc: loc(`/help/${article.slug}/`), lastmod: stamp(article.updatedAt) });
    for (const page of pages) if (page.slug) urls.push({ loc: loc(`/cms/${page.slug}/`), lastmod: stamp(page.updatedAt) });
    return urls;
  }
  if (shard === "categories") {
    const categories = await getCategories();
    return categories.filter((cat) => cat.slug).map((cat) => ({ loc: loc(`/${cat.slug}/`), lastmod: now }));
  }
  if (shard === "cities") {
    const [categories, cities] = await Promise.all([getCategories(), getCities()]);
    const urls: SitemapEntry[] = [];
    for (const cat of categories) {
      if (!cat.slug) continue;
      for (const city of cities) {
        if (city.slug) urls.push({ loc: loc(`/${cat.slug}/${city.slug}/`), lastmod: now });
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
          if (district.slug) urls.push({ loc: loc(`/${cat.slug}/${group.slug}/${district.slug}/`), lastmod: now });
        }
      }
    }
    return urls;
  }
  if (shard === "tags") {
    const [categories, custom, used] = await Promise.all([
      getCategories(),
      extraTags(),
      Listing.distinct("attributes.tag", { status: "active", "attributes.tag": { $type: "string" } }),
    ]);
    const tags = new Map<string, string>();
    for (const tag of TAG_PAGES) tags.set(tag.slug, tag.label);
    for (const tag of custom) tags.set(tag.slug, tag.label);
    const live = new Set(used.map((tag) => String(tag)));
    const urls: SitemapEntry[] = [];
    for (const cat of categories) {
      if (!cat.slug) continue;
      for (const [slug] of tags) {
        if (!live.has(slug)) continue;
        urls.push({ loc: loc(`/${cat.slug}/tag/${slug}/`), lastmod: now });
      }
    }
    return urls;
  }
  const ads = await Listing.find({ status: "active", slug: { $exists: true } }).select("slug updatedAt publishedAt").lean();
  return ads
    .filter((ad) => ad.slug)
    .map((ad) => ({ loc: loc(`/ad/${ad.slug}/`), lastmod: stamp(ad.updatedAt || ad.publishedAt) }));
}

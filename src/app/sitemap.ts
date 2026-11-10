import type { MetadataRoute } from "next";
import { connectDb } from "@/lib/db";
import { getBlogPosts, getCategories, getCities, getDistricts, getHelpArticles } from "@/lib/queries";
import { siteUrl } from "@/lib/utils";
import { Listing, Page } from "@/server/models";

export const dynamic = "force-dynamic";

function originOf() {
  return siteUrl().replace(/\/$/, "");
}

function entry(path: string, lastModified?: Date, changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"], priority?: number): MetadataRoute.Sitemap[number] {
  return {
    url: `${originOf()}${path}`,
    lastModified: lastModified || new Date(),
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    await connectDb();
  } catch {
    return [entry("/", new Date(), "daily", 1)];
  }
  const [categories, cities, posts, articles, pages, ads] = await Promise.all([
    getCategories(),
    getCities(),
    getBlogPosts(),
    getHelpArticles(),
    Page.find({ status: "published" }).select("slug updatedAt").lean(),
    Listing.find({ status: "active", slug: { $exists: true } }).select("slug updatedAt publishedAt").lean(),
  ]);
  const urls: MetadataRoute.Sitemap = [
    entry("/", new Date(), "daily", 1),
    entry("/cities/", new Date(), "weekly", 0.6),
    entry("/blog/", new Date(), "weekly", 0.5),
    entry("/help/", new Date(), "monthly", 0.4),
    entry("/contact/", new Date(), "yearly", 0.3),
    entry("/cms/about/", new Date(), "yearly", 0.3),
    entry("/cms/grievance/", new Date(), "yearly", 0.3),
    entry("/terms/", new Date(), "yearly", 0.2),
    entry("/privacy/", new Date(), "yearly", 0.2),
    entry("/cookies/", new Date(), "yearly", 0.2),
    entry("/scam-report/", new Date(), "yearly", 0.3),
  ];
  for (const page of pages) {
    if (page.slug) urls.push(entry(`/cms/${page.slug}/`, page.updatedAt, "monthly", 0.4));
  }
  for (const post of posts) {
    if (post.slug) urls.push(entry(`/blog/${post.slug}/`, post.updatedAt, "monthly", 0.5));
  }
  for (const article of articles) {
    if (article.slug) urls.push(entry(`/help/${article.slug}/`, article.updatedAt, "monthly", 0.4));
  }
  const districtLists = await Promise.all(
    cities.filter((city) => city.slug).map(async (city) => ({ city: city.slug!, rows: await getDistricts(city.slug!) })),
  );
  for (const cat of categories) {
    if (!cat.slug) continue;
    urls.push(entry(`/${cat.slug}/`, new Date(), "daily", 0.8));
    for (const city of cities) {
      if (!city.slug) continue;
      urls.push(entry(`/${cat.slug}/${city.slug}/`, new Date(), "daily", city.isTop ? 0.8 : 0.5));
    }
    for (const group of districtLists) {
      for (const district of group.rows) {
        if (district.slug) urls.push(entry(`/${cat.slug}/${group.city}/${district.slug}/`, new Date(), "daily", 0.5));
      }
    }
  }
  for (const ad of ads) {
    if (ad.slug) urls.push(entry(`/ad/${ad.slug}/`, ad.updatedAt || ad.publishedAt || new Date(), "weekly", 0.6));
  }
  return urls;
}

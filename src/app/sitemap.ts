import type { MetadataRoute } from "next";
import { getCategories, getCities, getFeed } from "@/lib/queries";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);
  const urls: MetadataRoute.Sitemap = [{ url: `${origin}/`, changeFrequency: "hourly", priority: 1 }];
  for (const cat of categories) {
    urls.push({ url: `${origin}/${cat.slug}/`, changeFrequency: "hourly", priority: 0.8 });
    for (const city of cities.filter((c) => c.isTop)) {
      urls.push({ url: `${origin}/${cat.slug}/${city.slug}/`, changeFrequency: "hourly", priority: 0.9 });
    }
  }
  const ads = await getFeed({}, 1);
  for (const ad of ads.items.slice(0, 25)) {
    urls.push({ url: `${origin}/ad/${ad.slug}/`, changeFrequency: "daily", priority: 0.6 });
  }
  return urls;
}

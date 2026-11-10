import { SITEMAP_SHARDS, sitemapIndexXml } from "@/lib/seo/sitemaps";

export const revalidate = 300;

export function GET() {
  return new Response(sitemapIndexXml([...SITEMAP_SHARDS]), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}

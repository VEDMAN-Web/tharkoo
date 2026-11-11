import { SITEMAP_SHARDS, sitemapIndexXml } from "@/lib/seo/sitemaps";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(sitemapIndexXml([...SITEMAP_SHARDS]), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=60, must-revalidate",
    },
  });
}

import { SITEMAP_SHARDS, adSitemapPages, sitemapIndexXml } from "@/lib/seo/sitemaps";

export const dynamic = "force-dynamic";

export async function GET() {
  // H18.4: one ads file per 10,000 live ads (ads.xml, ads-2.xml, ...). If the count fails, list one.
  const adPages = await adSitemapPages().catch(() => 1);
  return new Response(sitemapIndexXml([...SITEMAP_SHARDS], adPages), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=60, must-revalidate",
    },
  });
}

import { siteUrl } from "@/lib/utils";
import { isShard, shardEntries, sitemapXml } from "@/lib/seo/sitemaps";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ shard: string }> }) {
  const { shard } = await ctx.params;
  if (!isShard(shard)) return new Response("Not found", { status: 404 });
  try {
    const xml = sitemapXml(await shardEntries(shard));
    return new Response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=60, must-revalidate",
      },
    });
  } catch {
    return new Response(sitemapXml([{ loc: siteUrl().replace(/\/$/, "") + "/", lastmod: new Date().toISOString() }]), {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
  }
}

import { cachedShownCounts } from "@/server/analytics/counts";
import { parseCountSlugs } from "@/server/analytics/input";
import { handle, requestIdFrom, success } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * H6.17: shown views and clicks for the cards on screen. Cards ask every 30 seconds while the tab is visible.
 * Public numbers only; the response is cacheable for a short time.
 */
export const GET = handle(async (request: Request) => {
  const slugs = parseCountSlugs(new URL(request.url).searchParams.get("slugs"));
  const items = await cachedShownCounts(slugs);
  return Response.json(success({ items }, requestIdFrom(request)), {
    headers: { "Cache-Control": "public, max-age=10, s-maxage=15" },
  });
});

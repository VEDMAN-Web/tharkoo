import { rateLimited } from "@/server/search/rate";
import { queryListings } from "@/server/search";
import { handle, parseInput, requestIdFrom, success } from "@/server/http";
import { searchQuerySchema } from "@/server/shared/schemas/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function searchInput(url: URL) {
  const params = url.searchParams;
  const input: Record<string, unknown> = {};
  for (const key of ["q", "category", "city", "area", "badge", "sort", "page", "pageSize"] as const) {
    const value = params.get(key);
    if (value !== null) input[key] = value;
  }
  const verified = params.get("verified");
  if (verified === "true" || verified === "1") input.verified = true;
  if (verified === "false" || verified === "0") input.verified = false;
  const attributes = params.get("attributes");
  if (attributes !== null) {
    try {
      input.attributes = JSON.parse(attributes) as unknown;
    } catch {
      input.attributes = attributes;
    }
  }
  return input;
}

async function route(request: Request) {
  const requestId = requestIdFrom(request);
  const limited = rateLimited(request, "search", requestId);
  if (limited) return limited;
  const parsed = parseInput(searchQuerySchema, searchInput(new URL(request.url)));
  const result = await queryListings({
    q: parsed.q,
    categorySlug: parsed.category,
    citySlug: parsed.city,
    areaSlug: parsed.area,
    attributes: parsed.attributes,
    verified: parsed.verified,
    badge: parsed.badge,
    sort: parsed.sort ?? "ranked",
    page: parsed.page,
    pageSize: parsed.pageSize,
  });
  return Response.json(success({ hits: result.hits, total: result.total, facets: result.facets }, requestId), {
    headers: { "x-request-id": requestId },
  });
}

export const GET = handle(route);

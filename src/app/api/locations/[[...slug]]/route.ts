import { childLocations, listLocations, resolveLocations } from "@/server/locations";
import { rateLimited } from "@/server/search/rate";
import { NotFoundError, handle, parseInput, requestIdFrom, success } from "@/server/http";
import { locationQuerySchema, locationResolveQuerySchema } from "@/server/shared/schemas/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function segmentsOf(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  const prefix = "/api/locations";
  if (path === prefix) return [];
  if (!path.startsWith(`${prefix}/`)) return [];
  return path.slice(prefix.length + 1).split("/").filter(Boolean);
}

function json(data: unknown, requestId: string, status = 200, meta: Record<string, unknown> = {}, extra: Record<string, string> = {}) {
  return Response.json(success(data, requestId, meta), {
    status,
    headers: { "x-request-id": requestId, ...extra },
  });
}

async function route(request: Request) {
  const requestId = requestIdFrom(request);
  const limited = rateLimited(request, "locations", requestId);
  if (limited) return limited;
  const segments = segmentsOf(request);
  const url = new URL(request.url);

  if (segments.length === 0) {
    const raw: Record<string, string> = {};
    for (const key of ["type", "parentId", "q"] as const) {
      const value = url.searchParams.get(key);
      if (value) raw[key] = value;
    }
    const query = parseInput(locationQuerySchema, raw);
    return json({ locations: await listLocations(query) }, requestId);
  }

  if (segments[0] === "resolve" && segments.length === 1) {
    const slugs = url.searchParams
      .getAll("slugs")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);
    const query = parseInput(locationResolveQuerySchema, { slugs });
    const resolved = await resolveLocations(query.slugs);
    if (!resolved) throw new NotFoundError("Not found");
    if (resolved.redirected) {
      const location = `/api/locations/resolve?${resolved.canonicalSlugs
        .map((slug) => `slugs=${encodeURIComponent(slug)}`)
        .join("&")}`;
      return json({ chain: resolved.chain }, requestId, 301, { canonicalSlugs: resolved.canonicalSlugs }, { location });
    }
    return json({ chain: resolved.chain }, requestId);
  }

  if (segments.length === 2 && segments[1] === "children" && segments[0]) {
    const locations = await childLocations(segments[0]);
    if (!locations) throw new NotFoundError("Not found");
    return json({ locations }, requestId);
  }

  throw new NotFoundError("Not found");
}

export const GET = handle(route);

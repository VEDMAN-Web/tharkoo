import { publicCategories } from "@/server/search";
import { rateLimited } from "@/server/search/rate";
import { listLocations } from "@/server/locations";
import { handle, requestIdFrom, success } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function route(request: Request) {
  const requestId = requestIdFrom(request);
  const limited = rateLimited(request, "catalog", requestId);
  if (limited) return limited;
  const [categories, locations] = await Promise.all([publicCategories(), listLocations({})]);
  return Response.json(success({ categories, locations }, requestId), {
    headers: { "x-request-id": requestId },
  });
}

export const GET = handle(route);

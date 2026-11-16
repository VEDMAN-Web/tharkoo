import { rateLimited } from "@/server/search/rate";
import { suggestSearch } from "@/server/search/suggest";
import { handle, requestIdFrom, success } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function route(request: Request) {
  const requestId = requestIdFrom(request);
  const limited = rateLimited(request, "suggest", requestId);
  if (limited) return limited;
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const suggestions = await suggestSearch(q);
  return Response.json(success({ suggestions }, requestId), { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
}

export const GET = handle(route);

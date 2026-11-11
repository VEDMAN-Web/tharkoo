import { publicCategories } from "@/server/search";
import { rateLimited } from "@/server/search/rate";
import { handle, requestIdFrom, success } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function route(request: Request) {
  const requestId = requestIdFrom(request);
  const limited = rateLimited(request, "categories", requestId);
  if (limited) return limited;
  const categories = await publicCategories();
  return Response.json(success({ categories }, requestId), {
    headers: { "x-request-id": requestId },
  });
}

export const GET = handle(route);

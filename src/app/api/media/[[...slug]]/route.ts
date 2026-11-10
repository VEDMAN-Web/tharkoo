import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { NotFoundError, handle, parseInput, requestIdFrom, success } from "@/server/http";
import { completeMedia, deleteMedia, getMedia, reorderMedia, signMedia } from "@/server/media/service";
import { mediaCompleteBodySchema, mediaReorderBodySchema, mediaSignBodySchema } from "@/server/shared/schemas/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pathOf(request: Request) {
  return new URL(request.url).pathname.replace(/\/+$/, "").replace(/^\/api\/media\/?/, "");
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const path = pathOf(request);
  const { user } = await requireUser(readCookie(request, SESSION_COOKIE));
  const body = request.method === "GET" ? undefined : await request.json().catch(() => undefined);
  let data: unknown;
  if (request.method === "POST" && path === "sign") data = await signMedia(user.id, parseInput(mediaSignBodySchema, body), requestId);
  else if (request.method === "POST" && path === "complete") {
    data = await completeMedia(user.id, parseInput(mediaCompleteBodySchema, body).mediaId, requestId);
  } else if (request.method === "PATCH" && path === "reorder") {
    data = await reorderMedia(user.id, parseInput(mediaReorderBodySchema, body), requestId);
  } else if (request.method === "GET" && path && !path.includes("/")) data = await getMedia(user.id, user.roles, path);
  else if (request.method === "DELETE" && path && !path.includes("/")) data = await deleteMedia(user.id, path, requestId);
  else throw new NotFoundError("Not found");
  return Response.json(success(data, requestId), { headers: { "x-request-id": requestId } });
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);
export const PATCH = handle(dispatch);
export const DELETE = handle(dispatch);

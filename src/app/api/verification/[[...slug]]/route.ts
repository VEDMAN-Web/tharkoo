import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { NotFoundError, handle, parseInput, requestIdFrom, success } from "@/server/http";
import { verificationCompleteBodySchema, verificationUploadBodySchema } from "@/server/shared/schemas";
import { myStatus, submitVerification, uploadUrl } from "@/server/verification/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pathOf(request: Request) {
  return new URL(request.url).pathname.replace(/\/+$/, "").replace(/^\/api\/verification\/?/, "");
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const path = pathOf(request);
  const { user } = await requireUser(readCookie(request, SESSION_COOKIE));
  let data: unknown;
  if (request.method === "GET" && path === "status") data = await myStatus(user.id);
  else if (request.method === "POST" && path === "id/upload-url") {
    data = await uploadUrl(user.id, parseInput(verificationUploadBodySchema, await request.json().catch(() => undefined)), requestId);
  } else if (request.method === "POST" && path === "id/complete") {
    const body = parseInput(verificationCompleteBodySchema, await request.json().catch(() => undefined));
    data = await submitVerification(user.id, body, requestId);
  } else throw new NotFoundError("Not found");
  return Response.json(success(data, requestId), { headers: { "x-request-id": requestId } });
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);

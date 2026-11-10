import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { ForbiddenError, NotFoundError, handle, parseInput, requestIdFrom, success } from "@/server/http";
import { pageQuerySchema, verificationDecisionBodySchema } from "@/server/shared/schemas";
import { canReviewVerification, decideVerification, listPending, verificationFile } from "@/server/verification/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pathOf(request: Request) {
  return new URL(request.url).pathname.replace(/\/+$/, "").replace(/^\/api\/admin\/verifications\/?/, "");
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const { user } = await requireUser(readCookie(request, SESSION_COOKIE));
  if (!canReviewVerification(user.roles)) throw new ForbiddenError("Not allowed");
  const path = pathOf(request);
  let data: unknown;
  if (request.method === "GET" && path === "") {
    const page = parseInput(pageQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
    const queue = await listPending(page.page, page.pageSize);
    return Response.json(success(queue, requestId, { page: page.page, pageSize: page.pageSize, total: queue.total }), {
      headers: { "x-request-id": requestId },
    });
  }
  const decision = /^([^/]+)\/decision$/.exec(path);
  const file = /^([^/]+)\/file$/.exec(path);
  if (request.method === "POST" && decision) {
    const body = parseInput(verificationDecisionBodySchema, await request.json().catch(() => undefined));
    data = await decideVerification(user.id, decision[1], body.decision, body.reason, requestId);
  } else if (request.method === "GET" && file) {
    data = await verificationFile(user.id, user.roles, file[1], requestId);
  } else throw new NotFoundError("Not found");
  return Response.json(success(data, requestId), { headers: { "x-request-id": requestId } });
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);

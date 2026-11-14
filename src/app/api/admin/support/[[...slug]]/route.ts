import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { NotFoundError, handle, parseInput, requestIdFrom, success } from "@/server/http";
import { deskAssign, deskClose, deskQueue, deskReopen, deskReply, deskSetStatus, deskThread } from "@/server/support/desk";
import { screenshotsFrom } from "@/server/support/attachments";
import { queryObject, readSupportBody, segmentsAfter } from "@/server/support/http";
import { assignSchema, queueQuerySchema, replySchema, statusSchema } from "@/server/support/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff side of the support desk. Every method checks the desk role in the service before it reads or writes. */
async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const { user } = await requireUser(readCookie(request, SESSION_COOKIE));
  const actor = { id: user.id, roles: user.roles };
  const [first, id, third] = segmentsAfter(request, "/api/admin/support");
  const method = request.method;
  let data: unknown;
  if (first === "tickets" && !id && method === "GET") {
    data = await deskQueue(actor, parseInput(queueQuerySchema, queryObject(new URL(request.url))));
  } else if (first === "tickets" && id && !third && method === "GET") {
    data = await deskThread(actor, id, requestId);
  } else if (first === "tickets" && id && third === "messages" && method === "POST") {
    const { data: body, form } = await readSupportBody(request);
    const input = parseInput(replySchema, body);
    data = await deskReply(actor, id, input, await screenshotsFrom(form), requestId);
  } else if (first === "tickets" && id && third === "status" && method === "POST") {
    const body = parseInput(statusSchema, await request.json().catch(() => undefined));
    data = await deskSetStatus(actor, id, body.status, requestId);
  } else if (first === "tickets" && id && third === "assign" && method === "POST") {
    const body = parseInput(assignSchema, await request.json().catch(() => undefined));
    data = await deskAssign(actor, id, body.assigneeId, requestId);
  } else if (first === "tickets" && id && third === "close" && method === "POST") {
    data = await deskClose(actor, id, requestId);
  } else if (first === "tickets" && id && third === "reopen" && method === "POST") {
    data = await deskReopen(actor, id, requestId);
  } else throw new NotFoundError("Not found");
  return Response.json(success(data, requestId), { headers: { "x-request-id": requestId } });
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);

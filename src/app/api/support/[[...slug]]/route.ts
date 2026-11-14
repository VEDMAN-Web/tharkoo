import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { NotFoundError, handle, parseInput, requestIdFrom, success } from "@/server/http";
import { screenshotsFrom } from "@/server/support/attachments";
import { readSupportBody, segmentsAfter } from "@/server/support/http";
import { myThread, listMyTickets, openTicket, ownerCannotClose, replyAsOwner, unreadForOwner } from "@/server/support/tickets";
import { replySchema, ticketCreateSchema } from "@/server/support/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner side of the support desk. Owners never see internal notes and can never close a ticket. */
async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const { user } = await requireUser(readCookie(request, SESSION_COOKIE));
  const [first, id, third] = segmentsAfter(request, "/api/support");
  const method = request.method;
  let data: unknown;
  if (first === "unread" && method === "GET") data = { unread: await unreadForOwner(user.id) };
  else if (first === "tickets" && !id && method === "GET") data = await listMyTickets(user.id);
  else if (first === "tickets" && !id && method === "POST") {
    const { data: body, form } = await readSupportBody(request);
    const input = parseInput(ticketCreateSchema, body);
    data = await openTicket(user.id, input, await screenshotsFrom(form), requestId);
  } else if (first === "tickets" && id && !third && method === "GET") data = await myThread(user.id, id);
  else if (first === "tickets" && id && third === "messages" && method === "POST") {
    const { data: body, form } = await readSupportBody(request);
    const input = parseInput(replySchema, body);
    data = await replyAsOwner(user.id, id, { body: input.body, internal: false }, await screenshotsFrom(form), requestId);
  } else if (first === "tickets" && id && third === "close" && method === "POST") ownerCannotClose();
  else throw new NotFoundError("Not found");
  return Response.json(success(data, requestId), { headers: { "x-request-id": requestId } });
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);

import { clientKey } from "@/lib/rate-limit";
import { assertOrigin } from "@/server/auth/http";
import { NotFoundError, handle, requestIdFrom, success } from "@/server/http";
import { hashIp } from "@/server/shared/crypto";
import { guestReply, guestThread, openGuestTicket } from "@/server/support/guest";
import { segmentsAfter } from "@/server/support/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * H7.1: guest support. No account, and every call is a POST with a JSON body, so no token is put in a URL here.
 * - POST /api/support/guest/tickets  open a ticket with a name and an email or phone
 * - POST /api/support/guest/thread   {t} the ticket the link belongs to, without internal notes
 * - POST /api/support/guest/reply    {t, body} reply through the link
 */
async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => undefined);
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const [first] = segmentsAfter(request, "/api/support/guest");
  if (request.method !== "POST") throw new NotFoundError("Not found");
  assertOrigin(request);
  let data: unknown;
  if (first === "tickets") {
    const ipHash = hashIp(clientKey(request.headers)) ?? "";
    data = await openGuestTicket(await readJson(request), { ipHash, requestId });
  } else if (first === "thread") {
    data = await guestThread(await readJson(request));
  } else if (first === "reply") {
    data = await guestReply(await readJson(request), requestId);
  } else {
    throw new NotFoundError("Not found");
  }
  return Response.json(success(data, requestId), { headers: { "x-request-id": requestId } });
}

export const POST = handle(dispatch);

import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { json, readJson, segmentsOf } from "@/server/billing/http";
import { NotFoundError, handle, parseInput, requestIdFrom } from "@/server/http";
import { availabilityBodySchema, publicStatus, readOwnPresence, setOwnAvailable, touchOwnPresence } from "@/server/availability/service";
import { idSchema } from "@/server/shared/schemas/common";

/**
 * H7.5: the seller's "Available now" switch and activity ping (signed in), and the public status of one seller
 * (status and whether calls are allowed; never the switch or the times).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "/api/availability";

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const segments = segmentsOf(request, PREFIX);
  const path = segments.join("/");

  if (request.method === "GET" && segments[0] === "status" && segments.length === 2) {
    const id = parseInput(idSchema, segments[1]);
    return json(await publicStatus(id), requestId);
  }

  const user = await requireUser(readCookie(request, SESSION_COOKIE));
  if (request.method === "GET" && path === "") {
    return json(await readOwnPresence(user.user.id), requestId);
  }
  if (request.method === "PATCH" && path === "") {
    const body = parseInput(availabilityBodySchema, await readJson(request));
    return json(await setOwnAvailable(user.user.id, body.available), requestId);
  }
  if (request.method === "POST" && path === "activity") {
    return json(await touchOwnPresence(user.user.id), requestId);
  }
  throw new NotFoundError("Not found");
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);
export const PATCH = handle(dispatch);

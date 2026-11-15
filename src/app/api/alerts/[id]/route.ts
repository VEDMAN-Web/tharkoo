import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { removeSavedSearch } from "@/server/alerts/saved-searches";
import { UnauthorizedError, handle, requestIdFrom, success } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The id is the last path segment: /api/alerts/<id>. */
function idFrom(request: Request) {
  return decodeURIComponent(new URL(request.url).pathname.split("/").filter(Boolean).pop() ?? "");
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const session = await userFromToken(readCookie(request, SESSION_COOKIE)).catch(() => null);
  if (!session) throw new UnauthorizedError("Sign in to change your alerts");
  return Response.json(success(await removeSavedSearch(session.user.id, idFrom(request)), requestId));
}

export const DELETE = handle(dispatch);

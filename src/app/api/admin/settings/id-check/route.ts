import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { NotFoundError, handle, parseInput, requestIdFrom, success } from "@/server/http";
import { idCheckBodySchema, setIdCheckRequired } from "@/server/settings/id-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** H6.14: superadmin switches "Require ID check before posting" on or off. The service checks the role. */
async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const { user } = await requireUser(readCookie(request, SESSION_COOKIE));
  if (request.method !== "PUT") throw new NotFoundError("Not found");
  const body = parseInput(idCheckBodySchema, await request.json().catch(() => undefined));
  const data = await setIdCheckRequired({ actorId: user.id, roles: user.roles, required: body.required, requestId });
  return Response.json(success(data, requestId), { headers: { "x-request-id": requestId } });
}

export const PUT = handle(dispatch);

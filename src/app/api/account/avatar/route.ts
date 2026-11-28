import { AVATAR_MAX_BYTES, AVATAR_RULE } from "@/lib/ui/avatar";
import { removeAvatar, saveAvatar } from "@/server/auth/avatar";
import { RATE_WINDOW_MS, SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { requireUser } from "@/server/auth/service";
import { ValidationError, failure, handle, requestIdFrom, success } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANGES_PER_WINDOW = 10;
/** Room for the multipart wrapping around the photo itself. */
const BODY_LIMIT = AVATAR_MAX_BYTES + 64 * 1024;

function json(data: unknown, requestId: string) {
  return Response.json(success(data, requestId), { headers: { "x-request-id": requestId } });
}

/** POST: a multipart form with one `photo`. DELETE: back to the first letter. Only ever the signed-in person's own account. */
async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const { user } = await requireUser(readCookie(request, SESSION_COOKIE));
  if (request.method === "DELETE") return json(await removeAvatar(user.id), requestId);
  const limited = await consumeRateLimit(`avatar:${user.id}`, CHANGES_PER_WINDOW, RATE_WINDOW_MS);
  if (!limited.ok) {
    return Response.json(failure({ code: "RATE_LIMITED", message: "Too many photo changes. Try again later." }, requestId), {
      status: 429,
      headers: { "retry-after": String(limited.retryAfter), "x-request-id": requestId },
    });
  }
  if (Number(request.headers.get("content-length") || 0) > BODY_LIMIT) throw new ValidationError(AVATAR_RULE);
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File) || file.size > AVATAR_MAX_BYTES) throw new ValidationError(AVATAR_RULE);
  return json(await saveAvatar(user.id, { type: file.type, data: Buffer.from(await file.arrayBuffer()) }), requestId);
}

export const POST = handle(dispatch);
export const DELETE = handle(dispatch);

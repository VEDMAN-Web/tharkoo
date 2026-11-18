import { allowRequest, clientKey } from "@/lib/rate-limit";
import { assertOrigin } from "@/server/auth/http";
import { RateLimitedError, ValidationError, handle } from "@/server/http";
import { logNotFound } from "@/server/seo/notfound-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_MINUTE = 120;

/**
 * The 404 page tells the site which address was missing. It is a plain request, not a server action: a server action on a
 * 404 page makes the browser refresh the page tree, and the tab title falls back to the Home title (H10.3).
 */
export const POST = handle(async (request: Request) => {
  assertOrigin(request);
  if (!allowRequest(`notfound:${clientKey(request.headers)}`, PER_MINUTE, 60_000)) throw new RateLimitedError("Too many requests");
  let body: { path?: unknown; referrer?: unknown };
  try {
    body = (await request.json()) as { path?: unknown; referrer?: unknown };
  } catch {
    throw new ValidationError("Invalid request");
  }
  if (typeof body.path !== "string" || !body.path.startsWith("/")) throw new ValidationError("Invalid request");
  await logNotFound({
    path: body.path.slice(0, 300),
    userAgent: request.headers.get("user-agent"),
    referer: typeof body.referrer === "string" ? body.referrer.slice(0, 500) : "",
  });
  return new Response(null, { status: 204 });
});

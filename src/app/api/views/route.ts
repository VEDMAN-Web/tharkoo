import { allowRequest, clientKey } from "@/lib/rate-limit";
import { recordAdEvents } from "@/server/analytics/record";
import { adEventBatchSchema } from "@/server/analytics/input";
import { isBot } from "@/server/analytics/bots";
import { newVisitorId, visitorCookieFrom, visitorCookieHeader, visitorKeyFor } from "@/server/analytics/visitor";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { isStaffRole, userFromToken } from "@/server/auth/service";
import { RateLimitedError, ValidationError, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Browsers send a batch of views (and each click) here with sendBeacon. Always 204 on success; nothing is returned to the page. */
const BATCHES_PER_MINUTE = 120;

export const POST = handle(async (request: Request) => {
  assertOrigin(request);
  if (!allowRequest(`views:${clientKey(request.headers)}`, BATCHES_PER_MINUTE, 60_000)) {
    throw new RateLimitedError("Too many requests");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid request");
  }
  const parsed = adEventBatchSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid request");
  const bot = isBot(request.headers.get("user-agent"));
  const cookieId = visitorCookieFrom(request);
  const visitorId = cookieId ?? newVisitorId();
  const found = await userFromToken(readCookie(request, SESSION_COOKIE));
  const user = found?.user;
  await recordAdEvents(parsed.data.events, {
    visitorKey: visitorKeyFor({ userId: user?.id, cookieId: visitorId }),
    userId: user?.id,
    isStaff: user ? isStaffRole(user.roles) : false,
    isBot: bot,
  });
  const headers = new Headers();
  if (!cookieId) headers.append("Set-Cookie", visitorCookieHeader(visitorId));
  return new Response(null, { status: 204, headers });
});

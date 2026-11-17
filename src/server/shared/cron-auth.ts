import { UnauthorizedError } from "@/server/http";
import { safeEqual } from "@/server/shared/crypto";

/**
 * H7.154: who may call a cron route. The secret is CRON_SECRET and is never printed or logged.
 * Two ways in, both compared in constant time: the header `x-cron-secret` (what our own scheduler sends with POST), and
 * `Authorization: Bearer <secret>` (what Vercel Cron sends with GET). With no secret set on the server, nobody gets in.
 */
export function assertCronAuth(request: Request): void {
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected) throw new UnauthorizedError("Unauthorized");
  const header = request.headers.get("x-cron-secret") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim() ?? "";
  const ok = (header !== "" && safeEqual(header, expected)) || (bearer !== "" && safeEqual(bearer, expected));
  if (!ok) throw new UnauthorizedError("Unauthorized");
}

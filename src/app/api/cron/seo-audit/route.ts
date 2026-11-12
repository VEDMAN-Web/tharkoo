import { handle, parseInput, requestIdFrom, success, UnauthorizedError } from "@/server/http";
import { safeEqual } from "@/server/shared/crypto";
import { cronBodySchema } from "@/server/shared/schemas/common";
import { siteUrl } from "@/lib/utils";
import { runAudit } from "@/server/seo/audit-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const expected = process.env.CRON_SECRET ?? "";
  const given = request.headers.get("x-cron-secret") ?? "";
  if (!expected || !safeEqual(given, expected)) throw new UnauthorizedError("Unauthorized");
  parseInput(cronBodySchema, await readBody(request));
  const data = await runAudit({ base: siteUrl(), triggeredBy: "cron" });
  return Response.json(success(data, requestId), { status: 200, headers: { "x-request-id": requestId } });
}

export const POST = handle(dispatch);

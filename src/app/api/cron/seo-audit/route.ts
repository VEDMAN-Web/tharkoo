import { handle, parseInput, requestIdFrom, success } from "@/server/http";
import { assertCronAuth } from "@/server/shared/cron-auth";
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
  assertCronAuth(request);
  parseInput(cronBodySchema, await readBody(request));
  const data = await runAudit({ base: siteUrl(), triggeredBy: "cron" });
  return Response.json(success(data, requestId), { status: 200, headers: { "x-request-id": requestId } });
}

export const POST = handle(dispatch);
/** Vercel Cron calls with GET and `Authorization: Bearer <CRON_SECRET>`. */
export const GET = handle(dispatch);

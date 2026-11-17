import { runBoostCron } from "@/server/billing";
import { json } from "@/server/billing/http";
import { handle, parseInput, requestIdFrom } from "@/server/http";
import { assertCronAuth } from "@/server/shared/cron-auth";
import { cronBodySchema } from "@/server/shared/schemas/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return json(await runBoostCron(requestId), requestId);
}

export const POST = handle(dispatch);
/** Vercel Cron calls with GET and `Authorization: Bearer <CRON_SECRET>`. */
export const GET = handle(dispatch);

import { json } from "@/server/billing/http";
import { settleConnectedTours } from "@/server/tours/service";
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

/** H18.7: pays video calls where both people are connected (checked every minute). Same secret header as the other cron routes. */
async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertCronAuth(request);
  parseInput(cronBodySchema, await readBody(request));
  return json(await settleConnectedTours(requestId), requestId);
}

export const POST = handle(dispatch);
/** Called with `Authorization: Bearer <CRON_SECRET>`. */
export const GET = handle(dispatch);

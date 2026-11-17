import { json } from "@/server/billing/http";
import { handle, parseInput, requestIdFrom, UnauthorizedError } from "@/server/http";
import { purgeTrashedMedia } from "@/server/layout/media-admin";
import { safeEqual } from "@/server/shared/crypto";
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

/** H8.45: removes pictures that stayed in the Trash for 30 days. Same secret header as the other cron routes. */
async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const expected = process.env.CRON_SECRET ?? "";
  const given = request.headers.get("x-cron-secret") ?? "";
  if (!expected || !safeEqual(given, expected)) throw new UnauthorizedError("Unauthorized");
  parseInput(cronBodySchema, await readBody(request));
  return json(await purgeTrashedMedia(), requestId);
}

export const POST = handle(dispatch);

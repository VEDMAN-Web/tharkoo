import { handle, parseInput, requestIdFrom, success, UnauthorizedError } from "@/server/http";
import { expireDue } from "@/server/listings/service";
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

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const expected = process.env.CRON_SECRET ?? "";
  const given = request.headers.get("x-cron-secret") ?? "";
  if (!expected || !safeEqual(given, expected)) throw new UnauthorizedError("Unauthorized");
  parseInput(cronBodySchema, await readBody(request));
  const data = await expireDue(requestId);
  return Response.json(success(data, requestId), { status: 200, headers: { "x-request-id": requestId } });
}

export const POST = handle(dispatch);

import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { redeemCoupon } from "@/server/billing";
import { json, readJson, segmentsOf } from "@/server/billing/http";
import { NotFoundError, handle, parseInput, requestIdFrom } from "@/server/http";
import { couponRedeemBodySchema } from "@/server/shared/schemas/commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const user = await requireUser(readCookie(request, SESSION_COOKIE));
  const path = segmentsOf(request, "/api/coupons").join("/");
  if (request.method === "POST" && path === "redeem") {
    const body = parseInput(couponRedeemBodySchema, await readJson(request));
    return json(await redeemCoupon(user.user.id, body.code, requestId), requestId);
  }
  throw new NotFoundError("Not found");
}

export const POST = handle(dispatch);

import { z } from "zod";
import { clientKey } from "@/lib/rate-limit";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { listOrders, listProducts, purchasePromotion } from "@/server/billing";
import { json, readJson, segmentsOf } from "@/server/billing/http";
import { NotFoundError, handle, parseInput, requestIdFrom } from "@/server/http";
import { idSchema, pageQuerySchema } from "@/server/shared/schemas/common";
import { promotionCheckoutBodySchema } from "@/server/shared/schemas/commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const promoteBodySchema = z.object({
  listingId: idSchema,
  productId: idSchema,
  durationDays: z.number().int().positive().max(365).optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
  couponCode: z.string().trim().min(1).max(40).optional(),
  startsAt: z.string().datetime().optional(),
  autoRenew: z.boolean().optional(),
});

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const user = await requireUser(readCookie(request, SESSION_COOKIE));
  const path = segmentsOf(request, "/api/promotions").join("/");
  const ip = clientKey(request.headers);
  if (request.method === "GET" && path === "products") return json(await listProducts(), requestId);
  if (request.method === "GET" && path === "orders") {
    const query = parseInput(pageQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
    const data = await listOrders(user.user.id, query.page, query.pageSize);
    return json(data, requestId, 200, { page: query.page, pageSize: query.pageSize, total: data.total });
  }
  if (request.method === "POST" && path === "") {
    const body = parseInput(promoteBodySchema, await readJson(request));
    return json(await purchasePromotion({ ...body, userId: user.user.id, requestId, ip }), requestId);
  }
  if (request.method === "POST" && path === "checkout") {
    const body = parseInput(promotionCheckoutBodySchema, await readJson(request));
    return json(await purchasePromotion({ ...body, userId: user.user.id, requestId, ip }), requestId);
  }
  throw new NotFoundError("Not found");
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);

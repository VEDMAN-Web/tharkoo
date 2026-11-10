import { z } from "zod";
import { clientKey } from "@/lib/rate-limit";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { applyWebhook, checkoutPack, refundPayment } from "@/server/billing";
import { json, readJson, segmentsOf } from "@/server/billing/http";
import { assertWebhookSignature } from "@/server/billing/provider";
import { NotFoundError, handle, parseInput, requestIdFrom } from "@/server/http";
import { idSchema } from "@/server/shared/schemas/common";
import { paymentWebhookBodySchema, refundBodySchema } from "@/server/shared/schemas/commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutBodySchema = z.object({
  packId: idSchema,
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
  couponCode: z.string().trim().min(1).max(40).optional(),
});

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const path = segmentsOf(request, "/api/payments").join("/");
  if (request.method === "POST" && path === "webhook") {
    const raw = await request.text();
    assertWebhookSignature(request, raw);
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = undefined;
    }
    return json(await applyWebhook(parseInput(paymentWebhookBodySchema, body), requestId), requestId);
  }
  assertOrigin(request);
  const user = await requireUser(readCookie(request, SESSION_COOKIE));
  const ip = clientKey(request.headers);
  if (request.method === "POST" && path === "checkout") {
    const body = parseInput(checkoutBodySchema, await readJson(request));
    const data = await checkoutPack({
      userId: user.user.id,
      packId: body.packId,
      idempotencyKey: body.idempotencyKey,
      couponCode: body.couponCode,
      requestId,
      ip,
    });
    return json(data, requestId);
  }
  if (request.method === "POST" && path === "refund") {
    const body = parseInput(refundBodySchema, await readJson(request));
    return json(
      await refundPayment({
        actorId: user.user.id,
        roles: user.user.roles,
        paymentId: body.paymentId,
        amount: body.amount,
        reason: body.reason,
        requestId,
        ip,
      }),
      requestId,
    );
  }
  throw new NotFoundError("Not found");
}

export const POST = handle(dispatch);

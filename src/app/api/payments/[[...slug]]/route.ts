import { z } from "zod";
import { CUSTOM_MAX_PER_DAY_INR, CUSTOM_MAX_PER_PURCHASE_INR, CUSTOM_MIN_INR, MOVE_EARNINGS_MIN, callBalance, earningsBalance, moveEarningsToAdCredits } from "@/server/billing/wallets";
import { clientKey } from "@/lib/rate-limit";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { applyWebhook, checkoutPack, recordWebhookRejection, refundPayment, webhookRejection } from "@/server/billing";
import { json, readJson, segmentsOf } from "@/server/billing/http";
import { NotFoundError, ValidationError, handle, parseInput, requestIdFrom } from "@/server/http";
import { paymentsAvailable, settleOwnPending, settlePassimpay } from "@/server/billing/recharge";
import { verifyNotice } from "@/server/billing/passimpay";
import { chooseCoin, confirmMockPayment, listOwnPayments, readOwnPayment, rechargePacks, startRecharge, sheetPacks } from "@/server/billing/recharge";
import { postingFeeStatus } from "@/server/billing/posting-fee";
import { readPriceList } from "@/server/billing/price-list";
import { readMoneySettings } from "@/server/billing/money-settings";
import { walletBalance } from "@/server/billing";
import { pageQuerySchema } from "@/server/shared/schemas/common";
import { idSchema } from "@/server/shared/schemas/common";
import { paymentWebhookBodySchema, refundBodySchema } from "@/server/shared/schemas/commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const moveEarningsSchema = z.object({ amount: z.number().int().positive(), idempotencyKey: z.string().trim().min(8).max(200) });

const checkoutBodySchema = z.object({
  packId: idSchema,
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
  couponCode: z.string().trim().min(1).max(40).optional(),
});

const rechargeBodySchema = z.object({
  packId: idSchema.optional(),
  /** H18.8: a typed-in amount instead of a pack. */
  wallet: z.enum(["ad", "call"]).optional(),
  amountInr: z.number().int().positive().max(10_000_000).optional(),
  method: z.string().trim().max(20),
  coin: z.string().trim().max(10).optional(),
  network: z.string().trim().max(10).optional(),
  returnTo: z.string().trim().max(512).optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

const coinBodySchema = z.object({ coin: z.string().trim().max(10), network: z.string().trim().max(10).optional() });

const confirmBodySchema = z.object({ outcome: z.string().trim().max(20) });

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const path = segmentsOf(request, "/api/payments").join("/");
  if (request.method === "POST" && path === "webhook") {
    const raw = await request.text();
    const refusal = webhookRejection(request, raw);
    if (refusal) {
      await recordWebhookRejection(refusal, requestId);
      return Response.json(
        { ok: false, data: null, error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" } },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = undefined;
    }
    return json(await applyWebhook(parseInput(paymentWebhookBodySchema, body), requestId), requestId);
  }
  // H18.1: PassimPay's payment notice. A valid signature only makes us ask PassimPay for the order's status; the notice never credits.
  if (request.method === "POST" && path === "passimpay/webhook") {
    const raw = await request.text();
    const notice = verifyNotice(raw, request.headers.get("x-signature"));
    if (!notice.ok) {
      await recordWebhookRejection("passimpay-bad-signature", requestId);
      return Response.json({ ok: false }, { status: 400, headers: { "x-request-id": requestId } });
    }
    const outcome = notice.orderId ? await settlePassimpay(notice.orderId, requestId) : "ignored";
    return Response.json({ ok: true, outcome }, { status: 200, headers: { "x-request-id": requestId } });
  }
  assertOrigin(request);
  const user = await requireUser(readCookie(request, SESSION_COOKIE));
  const ip = clientKey(request.headers);
  if (request.method === "GET" && path === "packs") {
    // H18.1c: a buyer back from PassimPay sees the new balance at once.
    await settleOwnPending(user.user.id).catch(() => undefined);
    const [all, balance, fee, available, money, prices, callCredits, earnings] = await Promise.all([rechargePacks(), walletBalance(user.user.id), postingFeeStatus(user.user.id), paymentsAvailable(), readMoneySettings(), readPriceList(user.user.id), callBalance(user.user.id), earningsBalance(user.user.id)]);
    const packs = all.filter((pack) => pack.wallet === "ad");
    const callPacks = all.filter((pack) => pack.wallet === "call");
    const shortfall = Math.max(0, Math.floor(Number(new URL(request.url).searchParams.get("shortfall")) || 0));
    const custom = { min: CUSTOM_MIN_INR, maxPerPurchase: CUSTOM_MAX_PER_PURCHASE_INR, maxPerDay: CUSTOM_MAX_PER_DAY_INR, moveEarningsMin: MOVE_EARNINGS_MIN };
    return json({ packs: sheetPacks(packs, shortfall), all: packs, allPacks: packs.length, callPacks, balance, callBalance: callCredits, earnings, custom, fee: fee.fee, creditPriceInr: fee.creditPriceInr, available, testPayments: money.mockPaymentsOn, prices }, requestId);
  }
  if (request.method === "POST" && path === "move-earnings") {
    const body = parseInput(moveEarningsSchema, await readJson(request));
    return json(await moveEarningsToAdCredits({ userId: user.user.id, amount: body.amount, idempotencyKey: body.idempotencyKey, requestId, ip }), requestId);
  }
  if (request.method === "GET" && path === "history") {
    const query = parseInput(pageQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
    const data = await listOwnPayments(user.user.id, query.page, query.pageSize);
    return json(data, requestId, 200, { page: query.page, pageSize: query.pageSize, total: data.total });
  }
  if (request.method === "POST" && path === "recharge") {
    const body = parseInput(rechargeBodySchema, await readJson(request));
    if (!body.packId && !(body.wallet && body.amountInr)) throw new ValidationError("Invalid request", { packId: ["Choose a pack or type an amount"] });
    return json(await startRecharge({ ...body, userId: user.user.id, requestId, ip }), requestId);
  }
  const parts = segmentsOf(request, "/api/payments");
  if (request.method === "GET" && parts.length === 1 && parts[0] !== "checkout") {
    return json(await readOwnPayment(user.user.id, parts[0]), requestId);
  }
  if (request.method === "POST" && parts.length === 2 && parts[1] === "coin") {
    const body = parseInput(coinBodySchema, await readJson(request));
    return json(await chooseCoin({ userId: user.user.id, paymentId: parts[0], coin: body.coin, network: body.network, requestId }), requestId);
  }
  if (request.method === "POST" && parts.length === 2 && parts[1] === "confirm") {
    const body = parseInput(confirmBodySchema, await readJson(request));
    return json(await confirmMockPayment({ userId: user.user.id, paymentId: parts[0], outcome: body.outcome, requestId }), requestId);
  }
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

export const GET = handle(dispatch);
export const POST = handle(dispatch);

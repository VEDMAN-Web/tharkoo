import { clientKey } from "@/lib/rate-limit";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { json, readJson, segmentsOf } from "@/server/billing/http";
import { checkoutPack, listEntries, walletBalance } from "@/server/billing";
import { NotFoundError, handle, parseInput, requestIdFrom } from "@/server/http";
import { idSchema } from "@/server/shared/schemas/common";
import { walletPackBodySchema, walletQuerySchema } from "@/server/shared/schemas/commerce";
import {
  financeSettingsBodySchema,
  getFinanceSettings,
  listCoinPacks,
  listCoinPurchases,
  startCoinPurchase,
  updateFinanceSettings,
} from "@/server/wallet";
import { assertFinanceStaff } from "@/server/wallet/settings";
import { handlePayoutRequest } from "@/server/wallet/payout-api";
import { z } from "zod";

const coinCheckoutSchema = z.object({
  packId: idSchema,
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const segments = segmentsOf(request, "/api/wallet");
  const path = segments.join("/");
  const user = await requireUser(readCookie(request, SESSION_COOKIE));
  if (request.method === "GET" && path === "") {
    return json({ balance: await walletBalance(user.user.id) }, requestId);
  }
  if (request.method === "GET" && path === "entries") {
    const query = parseInput(walletQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
    const data = await listEntries(user.user.id, query.page, query.pageSize);
    return json(data, requestId, 200, { page: query.page, pageSize: query.pageSize, total: data.total });
  }
  if (request.method === "POST" && path === "packs") {
    const body = parseInput(walletPackBodySchema, await readJson(request));
    const data = await checkoutPack({
      userId: user.user.id,
      packId: body.packId,
      idempotencyKey: body.idempotencyKey,
      couponCode: body.couponCode,
      requestId,
      ip: clientKey(request.headers),
    });
    return json({ paymentId: data.paymentId, balance: data.balance, providerRef: data.providerRef }, requestId);
  }
  if (request.method === "GET" && path === "coins") {
    return json({ balance: await walletBalance(user.user.id), ...(await listCoinPacks()) }, requestId);
  }
  if (request.method === "POST" && path === "coins/checkout") {
    const body = parseInput(coinCheckoutSchema, await readJson(request));
    const data = await startCoinPurchase({
      userId: user.user.id,
      packId: body.packId,
      idempotencyKey: body.idempotencyKey,
      requestId,
      ip: clientKey(request.headers),
    });
    return json(data, requestId);
  }
  if (request.method === "GET" && path === "coins/purchases") {
    const query = parseInput(walletQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
    const data = await listCoinPurchases(user.user.id, query.page, query.pageSize);
    return json(data, requestId, 200, { page: query.page, pageSize: query.pageSize, total: data.total });
  }
  if (path === "admin/settings") {
    assertFinanceStaff(user.user.roles);
    if (request.method === "GET") return json(await getFinanceSettings(), requestId);
    if (request.method === "PUT") {
      const values = parseInput(financeSettingsBodySchema, await readJson(request));
      return json(
        await updateFinanceSettings({ actorId: user.user.id, roles: user.user.roles, values, requestId }),
        requestId,
      );
    }
  }
  const payout = await handlePayoutRequest(request, requestId, { id: user.user.id, roles: user.user.roles }, segments, clientKey(request.headers));
  if (payout) return payout;
  throw new NotFoundError("Not found");
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);
export const PUT = handle(dispatch);

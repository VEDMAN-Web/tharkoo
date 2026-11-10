import { clientKey } from "@/lib/rate-limit";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { json, readJson, segmentsOf } from "@/server/billing/http";
import { checkoutPack, listEntries, walletBalance } from "@/server/billing";
import { NotFoundError, handle, parseInput, requestIdFrom } from "@/server/http";
import { walletPackBodySchema, walletQuerySchema } from "@/server/shared/schemas/commerce";

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
  throw new NotFoundError("Not found");
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);

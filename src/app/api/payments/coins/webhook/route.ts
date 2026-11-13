import { AuditRepository } from "@/server/audit";
import { json } from "@/server/billing/http";
import { handle, requestIdFrom } from "@/server/http";
import { applyCoinEvent, verifyWebhook } from "@/server/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const audit = new AuditRepository();

/**
 * The only place coins are credited for a purchase. The browser redirect never reaches here.
 * Signature and timestamp are checked first; a refused request is recorded by reason only.
 */
async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const raw = await request.text();
  const refusal = verifyWebhook(request.headers, raw);
  if (refusal) {
    await audit.append({
      actorId: null,
      actorType: "system",
      action: "coins.webhook.rejected",
      targetType: "webhook",
      targetId: "coins",
      after: { reason: refusal },
      requestId,
    });
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
  return json(await applyCoinEvent(body, requestId), requestId);
}

export const POST = handle(dispatch);

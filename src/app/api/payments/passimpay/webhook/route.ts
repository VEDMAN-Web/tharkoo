import { AuditRepository } from "@/server/audit";
import { recordWebhookRejection } from "@/server/billing";
import { json } from "@/server/billing/http";
import { PASSIMPAY_ORDER_ID, verifyWebhookSignature } from "@/server/billing/passimpay";
import { confirmPassimpayOrder } from "@/server/billing/passimpay-events";
import { handle, requestIdFrom } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const audit = new AuditRepository();
const MAX_BODY = 8 * 1024;

/**
 * H18.1: PassimPay's deposit notification. The signature is checked first (a refusal is recorded by reason only).
 * A valid webhook only tells us WHICH order to look at: the credit is given only when PassimPay itself says "paid"
 * (orderstatus), through the same path as every other payment. The body alone never credits.
 */
async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const raw = await request.text();
  // A real notification is a few hundred bytes: anything large is refused before any work or any audit row.
  if (raw.length > MAX_BODY) return Response.json({ ok: false, data: null, error: { code: "TOO_LARGE", message: "Request too large" } }, { status: 413, headers: { "x-request-id": requestId } });
  const header = request.headers.get("x-signature");
  const verdict = verifyWebhookSignature(raw, header);
  if (!verdict.ok) {
    await recordWebhookRejection(header?.trim() ? "bad-signature" : "missing", requestId);
    return Response.json(
      { ok: false, data: null, error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" } },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  let orderId = "";
  try {
    const body = JSON.parse(raw) as { orderId?: unknown };
    orderId = typeof body?.orderId === "string" ? body.orderId : String(body?.orderId ?? "");
  } catch {
    orderId = "";
  }
  const outcome = PASSIMPAY_ORDER_ID.test(orderId) ? await confirmPassimpayOrder(orderId, requestId) : "unknown";
  await audit.append({
    actorId: null,
    actorType: "system",
    action: "payment.passimpay.webhook",
    targetType: "webhook",
    targetId: "passimpay",
    requestId,
    after: { signedOver: verdict.form, outcome },
  });
  return json({ received: true }, requestId);
}

export const POST = handle(dispatch);

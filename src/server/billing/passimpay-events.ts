import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { orderStatus } from "@/server/billing/passimpay";
import { applyWebhook } from "@/server/billing/service";
import { ConflictError, InternalError } from "@/server/http";
import { Payment } from "@/server/models";

const audit = new AuditRepository();

export type PassimpayOutcome = "unknown" | "paid" | "wait" | "failed";

/**
 * Confirms one PassimPay order with PassimPay itself and credits it through the one existing path (applyWebhook).
 * Only the status the provider gives back counts: a webhook body or a return to the site never credits on its own.
 */
export async function confirmPassimpayOrder(orderId: string, requestId: string): Promise<PassimpayOutcome> {
  await connectDb();
  if (!/^[a-f0-9]{24}$/i.test(orderId)) return "unknown";
  const payment = await Payment.findOne({ providerRef: orderId, provider: "passimpay" });
  if (!payment) return "unknown";
  if (payment.status === "paid") return "paid";
  const answer = await orderStatus(orderId);
  if (answer.status === "wait") return "wait";
  if (answer.status === "error") {
    await applyWebhook({ eventId: `passimpay:${orderId}`, providerRef: orderId, status: "failed", confirmedBy: "passimpay" }, requestId);
    return "failed";
  }
  // Paid. The amount cannot be checked without the currency, so no currency means no credit; in rupees the amount must cover the price;
  // in any other currency the provider's own "paid" stands.
  if (answer.currency === null) throw new ConflictError("Amount does not match");
  if (answer.currency === "INR" && !(answer.amountPaid !== null && answer.amountPaid >= payment.amount)) {
    throw new ConflictError("Amount does not match");
  }
  await applyWebhook({ eventId: `passimpay:${orderId}`, providerRef: orderId, status: "paid", confirmedBy: "passimpay" }, requestId);
  // A delivery that lost the claim to a delivery that then failed must not answer "done": the provider will deliver again.
  const after = await Payment.findById(payment._id).select("status").lean<{ status?: string } | null>();
  if (after?.status !== "paid") throw new InternalError("Payment provider is not available");
  return "paid";
}

/** What happened to the newest waiting PassimPay payment of a buyer who came back to the credits page. */
export type ReturnOutcome = PassimpayOutcome | "none" | "unavailable";

/** The safety net for a lost webhook: on the success return, check the buyer's newest pending PassimPay payment. Never throws. */
export async function confirmNewestPassimpayForUser(userId: string, requestId: string): Promise<ReturnOutcome> {
  try {
    await connectDb();
    const payment = await Payment.findOne({ userId, provider: "passimpay", status: "pending" }).sort({ createdAt: -1, _id: -1 }).lean<{ providerRef?: string } | null>();
    if (!payment?.providerRef) return "none";
    const outcome = await confirmPassimpayOrder(payment.providerRef, requestId);
    await audit.append({ actorId: userId, actorType: "user", action: "payment.passimpay.return_checked", targetType: "payment", targetId: payment.providerRef, requestId, after: { outcome } });
    return outcome;
  } catch (error) {
    // The provider being down or answering oddly must not break the page; the webhook can still credit later. The reason is kept, never a value.
    await audit.append({ actorId: userId, actorType: "user", action: "payment.passimpay.return_check_failed", targetType: "user", targetId: userId, requestId, after: { reason: error instanceof Error ? error.name : "error" } }).catch(() => undefined);
    return "unavailable";
  }
}

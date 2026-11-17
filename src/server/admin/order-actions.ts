import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { applyWebhook, refundPayment, refundableCredits } from "@/server/billing/service";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http";
import { Payment, WalletEntry } from "@/server/models";

/**
 * H8.24 (A24): the three things staff can do to a recharge. Each one goes through adminWrite (finance or admin permission, a reason,
 * blocked words, audit) and none of them talks to a payment provider.
 * - Mark paid: the same fulfilment as a "paid" webhook, claimed once, so a late real webhook adds nothing twice.
 * - Mark failed: only for a payment still waiting. No credits move.
 * - Give credits back: `refundPayment`. Credits given back cannot be taken back, so the change is locked (no undo).
 */

export type OrderActionResult = { eventId: string; undoUntil: string | null; summary: string; credits?: number; balance?: number };

type PaymentLean = { _id: Types.ObjectId; userId: Types.ObjectId; status: "pending" | "paid" | "failed"; provider?: string; method?: string; credits?: number; amount: number; idempotencyKey: string; providerEventId?: string; outcome?: string };

const receiptNo = (id: string) => `TK-${id.slice(-8).toUpperCase()}`;

async function load(paymentId: string): Promise<PaymentLean> {
  await connectDb();
  if (!mongoose.isValidObjectId(paymentId)) throw new NotFoundError("Not found");
  const payment = await Payment.findById(paymentId).lean<PaymentLean | null>();
  if (!payment || !payment.method || payment.provider === "wallet") throw new NotFoundError("Not found");
  return payment;
}

function cleanReason(reason: unknown): string {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length < 1) throw new ValidationError("Write why you are doing this.");
  return text;
}

/** What staff may do to this payment right now. A test payment (provider "mock") finishes on its own checkout and is left alone. */
export function actionsFor(payment: { status: string; provider?: string }, refundable: number): { markPaid: boolean; markFailed: boolean; refund: boolean } {
  const live = payment.provider !== "mock";
  return {
    markPaid: live && (payment.status === "pending" || payment.status === "failed"),
    markFailed: live && payment.status === "pending",
    refund: live && payment.status === "paid" && refundable > 0,
  };
}

/** Marks a waiting (or failed) recharge as paid and adds its credits once. Undo (7 days) takes the credits back only while they are unspent. */
export async function markRechargePaid(ctx: AdminCtx, input: { paymentId: string; reason: unknown }): Promise<OrderActionResult> {
  await connectDb();
  const reason = cleanReason(input.reason);
  const payment = await load(input.paymentId);
  if (payment.provider === "mock") throw new ConflictError("This is a test payment. It finishes on its own checkout.");
  if (payment.status === "paid") throw new ConflictError("This recharge is already paid. Nothing was added twice.");
  const eventId = `staff-paid:${payment._id}:${ctx.requestId}`;
  const label = receiptNo(String(payment._id));
  const written = await adminWrite(ctx, {
    perm: "orders.refund",
    action: "recharge.mark_paid",
    target: { type: "user", id: String(payment.userId), label },
    reason,
    reasonRequired: true,
    texts: [reason],
    undo: { kind: "wallet.adjust", windowKey: "credits" },
    before: async () => ({ payment: label, status: payment.status }),
    apply: async () => {
      await applyWebhook({ eventId, idempotencyKey: payment.idempotencyKey, status: "paid", amount: payment.amount }, ctx.requestId);
      const after = await Payment.findById(payment._id).select("status providerEventId").lean<{ status: string; providerEventId?: string } | null>();
      if (!after || after.status !== "paid" || after.providerEventId !== eventId) throw new ConflictError("Someone else changed this recharge a moment ago. Nothing was added twice.");
      const id = String(payment._id);
      const lines = await WalletEntry.find({ userId: payment.userId, refId: { $in: [id, `${id}:bonus`, `${id}:coupon`] } }).select("delta").lean<{ delta: number }[]>();
      const credits = lines.reduce((sum, line) => sum + Math.max(0, line.delta), 0);
      return {
        after: { payment: label, status: "paid", creditsAdded: credits },
        result: credits,
        undoData: { delta: credits },
        summary: `Marked ${label} paid: ${credits.toLocaleString("en-IN")} credits added. ${reason}`,
      };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `${label} marked paid`, credits: written.result };
}

/** Marks a waiting recharge as failed. No credits move. A real payment confirmation that arrives later can still complete it. */
export async function markRechargeFailed(ctx: AdminCtx, input: { paymentId: string; reason: unknown }): Promise<OrderActionResult> {
  await connectDb();
  const reason = cleanReason(input.reason);
  const payment = await load(input.paymentId);
  if (payment.provider === "mock") throw new ConflictError("This is a test payment. It finishes on its own checkout.");
  if (payment.status !== "pending") throw new ConflictError("Only a recharge that is still waiting can be marked failed.");
  const label = receiptNo(String(payment._id));
  const written = await adminWrite(ctx, {
    perm: "orders.refund",
    action: "recharge.mark_failed",
    target: { type: "payment", id: String(payment._id), label },
    reason,
    reasonRequired: true,
    texts: [reason],
    before: async () => ({ payment: label, status: payment.status }),
    apply: async () => {
      const claimed = await Payment.findOneAndUpdate({ _id: payment._id, status: "pending" }, { $set: { status: "failed", outcome: "failed", providerEventId: `staff-failed:${payment._id}` } }, { returnDocument: "before" }).lean();
      if (!claimed) throw new ConflictError("Someone else changed this recharge a moment ago.");
      return { after: { payment: label, status: "failed" }, result: null, summary: `Marked ${label} failed. ${reason}` };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `${label} marked failed` };
}

/** Gives credits back for a paid recharge, up to what it credited. Locked: credits given back cannot be undone. */
export async function giveCreditsBack(ctx: AdminCtx, input: { paymentId: string; amount: unknown; reason: unknown }): Promise<OrderActionResult> {
  await connectDb();
  const reason = cleanReason(input.reason);
  const amount = typeof input.amount === "number" ? input.amount : typeof input.amount === "string" && input.amount.trim() !== "" ? Number(input.amount) : Number.NaN;
  if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) throw new ValidationError("Enter a whole number of credits, 1 or more.");
  const payment = await load(input.paymentId);
  if (payment.provider === "mock") throw new ConflictError("This is a test payment. There is nothing to give back.");
  if (payment.status !== "paid") throw new ConflictError("Only a paid recharge can have credits given back.");
  const left = await refundableCredits(payment);
  if (amount > left) throw new ConflictError(left > 0 ? `At most ${left.toLocaleString("en-IN")} credits can still be given back for this recharge.` : "All the credits of this recharge were already given back.");
  const label = receiptNo(String(payment._id));
  const written = await adminWrite(ctx, {
    perm: "orders.refund",
    action: "recharge.refund",
    target: { type: "user", id: String(payment.userId), label },
    reason,
    reasonRequired: true,
    texts: [reason],
    undo: { lock: "money_sent" },
    before: async () => ({ payment: label, refundableCredits: left }),
    apply: async () => {
      // The ledger line is keyed by payment, amount and reason, so sending the same refund twice is refused (ConflictError "Refund already exists").
      const done = await refundPayment({ actorId: ctx.actorId, roles: ["finance"], paymentId: String(payment._id), amount, reason, requestId: ctx.requestId });
      return { after: { payment: label, creditsGivenBack: amount, balanceAfter: done.balance }, result: done.balance, summary: `Gave back ${amount.toLocaleString("en-IN")} credits for ${label}. ${reason}` };
    },
  });
  return { eventId: written.eventId, undoUntil: null, summary: `${amount.toLocaleString("en-IN")} credits given back for ${label}`, credits: amount, balance: written.result };
}

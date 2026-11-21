import mongoose, { type Types } from "mongoose";
import { callBalance, moveCallCredits } from "@/server/billing/wallets";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { eventIsUndone } from "@/server/admin/undo/core";
import { adminWrite } from "@/server/admin/write";
import { creditWallet, debitWallet, walletBalance } from "@/server/billing/ledger";
import { ConflictError, ForbiddenError, NotFoundError, PaymentRequiredError, ValidationError } from "@/server/http";
import { AuditEvent, Payment, User, WalletEntry } from "@/server/models";

/**
 * H8.14 (A14): staff add or remove credits with a reason, the Credits tab data, and the ledger side of undo.
 * Every change is one ledger line (refType "staff_adjust") written through adminWrite: permission, reason, blocked words, audit.
 * Undo writes a reversing line (refType "staff_adjust_undo") and never reads anything but the saved undo data.
 */

export const STAFF_ADJUST = "staff_adjust";
export const STAFF_ADJUST_UNDO = "staff_adjust_undo";
// H18.8 (Vedant): staff may add any amount. This only stops a typo with too many zeros.
export const MAX_ADJUST = 10_000_000;
export const ADJUST_ACTION = "wallet.adjust";
const REQUEST_KEY = /^[A-Za-z0-9_-]{8,64}$/;
const LINES_SHOWN = 25;
const STAFF_EVENTS_LOOKED_AT = 100;
const SPENT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AdjustData = { delta: number };
export type AdjustResult = { eventId: string; undoUntil: string | null; summary: string; balance: number };

/** The permission that applies to this person: finance and admins may adjust anyone, support only their own changes (see undo). */
function adjustPerm(roles: readonly string[]) {
  return can(roles, "wallet.adjust") ? ("wallet.adjust" as const) : ("wallet.adjust.own" as const);
}

export function credits(count: number) {
  return `${count.toLocaleString("en-IN")} ${count === 1 ? "credit" : "credits"}`;
}

/**
 * Adds (amount above 0) or removes (amount below 0) credits for one user. `requestKey` is made once per dialog, so a double click
 * or a retry cannot write the line twice. The balance can never go below 0.
 */
export async function adjustCredits(ctx: AdminCtx, input: { userId: string; amount: number; reason: string; requestKey: string; wallet?: "ad" | "call" }): Promise<AdjustResult> {
  await connectDb();
  const { amount } = input;
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_ADJUST) {
    throw new ValidationError(`Enter a whole number of credits from 1 to ${MAX_ADJUST.toLocaleString("en-IN")}.`);
  }
  if (!REQUEST_KEY.test(input.requestKey)) throw new ValidationError("Try again. This request was not valid.");
  if (!mongoose.isValidObjectId(input.userId)) throw new NotFoundError("Not found");
  const user = await User.findById(input.userId).select("displayName status").lean<{ _id: Types.ObjectId; displayName: string; status: string } | null>();
  if (!user) throw new NotFoundError("Not found");
  if (user.status === "deleted") throw new ConflictError("This account was deleted");
  const userId = String(user._id);
  const verb = amount > 0 ? "Added" : "Removed";
  if (input.wallet === "call") return adjustCallCredits(ctx, { ...input, userId, name: user.displayName, verb });
  const written = await adminWrite(ctx, {
    perm: adjustPerm(ctx.roles),
    action: ADJUST_ACTION,
    target: { type: "user", id: userId, label: user.displayName },
    reason: input.reason,
    reasonRequired: true,
    texts: [input.reason],
    undo: { kind: "wallet.adjust", windowKey: "credits" },
    before: async () => ({ balance: await walletBalance(userId) }),
    apply: async () => {
      const line = { userId, refType: STAFF_ADJUST, refId: input.requestKey, requestId: ctx.requestId, actorId: ctx.actorId, actorType: "admin" as const, once: true };
      let done: { balance: number; created: boolean };
      if (amount > 0) {
        done = await creditWallet({ ...line, amount, auditAction: "wallet.staff_credit", auditReason: input.reason });
      } else {
        const balance = await walletBalance(userId);
        if (balance < -amount) throw new ConflictError(`${user.displayName} has only ${credits(balance)}. You cannot remove more than that.`);
        try {
          done = await debitWallet({ ...line, amount: -amount, auditAction: "wallet.staff_debit", auditReason: input.reason });
        } catch (error) {
          // The balance dropped between the check above and the ledger line (the person spent credits at the same moment).
          if (error instanceof PaymentRequiredError) throw new ConflictError(`${user.displayName} has fewer credits than that right now. Open the Credits tab and try again.`);
          throw error;
        }
      }
      if (!done.created) throw new ConflictError("This change was already made. Nothing was added twice.");
      return {
        after: { delta: amount, balanceAfter: done.balance, refId: input.requestKey },
        result: done.balance,
        undoData: { delta: amount } satisfies AdjustData,
        summary: `${verb} ${credits(Math.abs(amount))} ${amount > 0 ? "to" : "from"} ${user.displayName}: ${input.reason}`,
      };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, balance: written.result, summary: `${verb} ${credits(Math.abs(amount))} ${amount > 0 ? "to" : "from"} ${user.displayName}` };
}

/**
 * The ledger line an undo writes: the opposite of what `delta` did. It is refused (ConflictError) when it would take more than the
 * user has left, which is how "spent" credits block an undo. The line key is the undo event, so a repeat does nothing.
 */
export async function reverseCredits(input: { userId: string; delta: number; eventId: string; ctx: AdminCtx }): Promise<{ delta: number; balance: number }> {
  await connectDb();
  const back = -input.delta;
  const line = { userId: input.userId, refType: STAFF_ADJUST_UNDO, refId: `undo:${input.eventId}`, requestId: input.ctx.requestId, actorId: input.ctx.actorId, actorType: "admin" as const, once: true };
  if (back > 0) {
    const done = await creditWallet({ ...line, amount: back, auditAction: "wallet.staff_undo", auditReason: "Undo of a staff credit change" });
    return { delta: back, balance: done.balance };
  }
  const done = await debitWallet({ ...line, amount: -back, auditAction: "wallet.staff_undo", auditReason: "Undo of a staff credit change" });
  return { delta: back, balance: done.balance };
}

export type CreditLine = {
  id: string;
  delta: number;
  title: string;
  detail: string;
  at: string | null;
  /** A recharge line: what the receipt says. */
  receipt: { no: string; amount: number; method: string; test: boolean } | null;
  /** A staff change: its event, and what the viewer can do with it. */
  staff: null | {
    eventId: string;
    state: "undoable" | "partly_spent" | "spent" | "undone" | "expired" | "not_yours";
    /** Credits that can still be taken back when the change is partly spent. */
    left: number;
  };
};

export type CreditsTab = {
  balance: number;
  spent30: number;
  paidTotal: number;
  lines: CreditLine[];
  total: number;
};

const REFERENCE_TITLES: Record<string, string> = {
  pack_bonus: "Bonus credits",
  coupon: "Coupon credits",
  promotion: "Promotion",
  promotion_reversal: "Promotion cancelled",
  refund: "Refund",
  video_tour: "Video tour",
  coin_purchase: "Credit purchase",
  booking: "Booking",
  withdrawal: "Withdrawal",
  [STAFF_ADJUST_UNDO]: "Staff change undone",
};

function referenceTitle(refType: string): string {
  if (REFERENCE_TITLES[refType]) return REFERENCE_TITLES[refType];
  const text = refType.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Credit change";
}

type StaffEvent = { _id: Types.ObjectId; actorId?: Types.ObjectId | null; reason?: string; createdAt?: Date; after?: { refId?: string }; undo?: { until?: Date } };

/** Seeing the Credits tab needs any wallet permission. Adjusting needs finance, an admin or support. */
export function canSeeCredits(roles: readonly string[]) {
  return can(roles, "wallet.view") || can(roles, "wallet.adjust") || can(roles, "wallet.adjust.own");
}
export function canAdjustCredits(roles: readonly string[]) {
  return can(roles, "wallet.adjust") || can(roles, "wallet.adjust.own");
}

/** Support may undo only the changes they made themselves; finance and admins may undo any (the handler checks the same rule). */
export function mayUndoStaffChange(roles: readonly string[], viewerId: string, eventActorId: string | null) {
  return can(roles, "wallet.adjust") || (can(roles, "wallet.adjust.own") && eventActorId !== null && eventActorId === viewerId);
}

/** The Credits tab of the Users drawer: balance, spend, paid total and the latest ledger lines with their receipts and undo state. */
export async function getCreditsTab(userId: string, roles: readonly string[], viewerId: string): Promise<CreditsTab> {
  await connectDb();
  if (!canSeeCredits(roles)) throw new ForbiddenError("You do not have permission to do this");
  if (!mongoose.isValidObjectId(userId)) throw new NotFoundError("Not found");
  const id = new mongoose.Types.ObjectId(userId);
  const now = Date.now();
  const since = new Date(now - SPENT_DAYS * DAY_MS);
  const [balance, rows, total, spentRows, paidRows, events] = await Promise.all([
    walletBalance(userId),
    WalletEntry.find({ userId: id }).sort({ createdAt: -1, _id: -1 }).limit(LINES_SHOWN).lean(),
    WalletEntry.countDocuments({ userId: id }),
    WalletEntry.find({ userId: id, delta: { $lt: 0 }, createdAt: { $gte: since }, refType: { $nin: [STAFF_ADJUST, STAFF_ADJUST_UNDO] } }).select("delta").lean(),
    Payment.find({ userId: id, status: "paid", provider: { $ne: "mock" } }).select("amount").lean(),
    AuditEvent.find({ action: ADJUST_ACTION, targetType: "user", targetId: userId }).sort({ _id: -1 }).limit(STAFF_EVENTS_LOOKED_AT).select("actorId reason createdAt after undo").lean<StaffEvent[]>(),
  ]);

  const byRef = new Map<string, StaffEvent>();
  for (const event of events) if (event.after?.refId) byRef.set(event.after.refId, event);
  const actorIds = [...new Set(events.map((event) => (event.actorId ? String(event.actorId) : "")).filter(Boolean))];
  const actors = actorIds.length ? await User.find({ _id: { $in: actorIds } }).select("displayName").lean<{ _id: Types.ObjectId; displayName: string }[]>() : [];
  const actorName = new Map(actors.map((actor) => [String(actor._id), actor.displayName]));

  const paymentIds = rows.filter((row) => row.refType === "pack" && mongoose.isValidObjectId(row.refId)).map((row) => row.refId);
  const payments = paymentIds.length ? await Payment.find({ _id: { $in: paymentIds } }).select("amount method provider").lean<{ _id: Types.ObjectId; amount: number; method?: string; provider?: string }[]>() : [];
  const payment = new Map(payments.map((row) => [String(row._id), row]));

  const lines: CreditLine[] = [];
  for (const row of rows) {
    const at = row.createdAt ? new Date(row.createdAt).toISOString() : null;
    const base = { id: String(row._id), delta: row.delta, at, receipt: null as CreditLine["receipt"], staff: null as CreditLine["staff"] };
    if (row.refType === "pack") {
      const paid = payment.get(row.refId);
      const method = paid?.method === "crypto" ? "crypto" : "card";
      lines.push({ ...base, title: `Recharge TK-${row.refId.slice(-8).toUpperCase()}`, detail: paid ? `₹${paid.amount.toLocaleString("en-IN")} ${method}` : "Recharge", receipt: paid ? { no: `TK-${row.refId.slice(-8).toUpperCase()}`, amount: paid.amount, method, test: paid.provider === "mock" } : null });
      continue;
    }
    if (row.refType === STAFF_ADJUST) {
      const event = byRef.get(row.refId);
      const who = event?.actorId ? (actorName.get(String(event.actorId)) ?? "staff") : "staff";
      const verb = row.delta > 0 ? "Added" : "Removed";
      let staff: CreditLine["staff"] = null;
      if (event) {
        const eventId = String(event._id);
        let state: NonNullable<CreditLine["staff"]>["state"] = "undoable";
        let left = 0;
        if (await eventIsUndone(eventId)) state = "undone";
        else if (event.undo?.until && new Date(event.undo.until).getTime() < now) state = "expired";
        else if (!mayUndoStaffChange(roles, viewerId, event.actorId ? String(event.actorId) : null)) state = "not_yours";
        else if (row.delta > 0 && balance < row.delta) {
          left = Math.max(balance, 0);
          state = left > 0 ? "partly_spent" : "spent";
        }
        staff = { eventId, state, left };
      }
      lines.push({ ...base, title: `${verb} by ${who}${event?.reason ? ` · ${event.reason}` : ""}`, detail: "", staff });
      continue;
    }
    lines.push({ ...base, title: referenceTitle(row.refType), detail: "" });
  }

  return {
    balance,
    spent30: spentRows.reduce((sum, row) => sum - row.delta, 0),
    paidTotal: paidRows.reduce((sum, row) => sum + row.amount, 0),
    lines,
    total,
  };
}

/**
 * H18.8: staff add or remove call credits. No undo button: make the opposite change instead. The ledger never lets the
 * balance go below 0, and the request key stops a double click from writing twice.
 */
async function adjustCallCredits(ctx: AdminCtx, input: { userId: string; amount: number; reason: string; requestKey: string; name: string; verb: string }): Promise<AdjustResult> {
  const { amount, userId } = input;
  const label = `${input.verb} ${credits(Math.abs(amount))} of call credits ${amount > 0 ? "to" : "from"} ${input.name}`;
  const written = await adminWrite(ctx, {
    perm: adjustPerm(ctx.roles),
    action: ADJUST_ACTION,
    target: { type: "user", id: userId, label: input.name },
    reason: input.reason,
    reasonRequired: true,
    texts: [input.reason],
    before: async () => ({ callBalance: await callBalance(userId) }),
    apply: async () => {
      if (amount < 0) {
        const balance = await callBalance(userId);
        if (balance < -amount) throw new ConflictError(`${input.name} has only ${credits(balance)} of call credits. You cannot remove more than that.`);
      }
      const done = await moveCallCredits({ userId, amount, key: `staff-call:${input.requestKey}`, kind: amount > 0 ? "staff_call_credit" : "staff_call_debit", requestId: ctx.requestId, actorId: ctx.actorId, actorType: "admin", reason: input.reason });
      if (!done.created) throw new ConflictError("This change was already made. Nothing was added twice.");
      const balance = await callBalance(userId);
      return { after: { wallet: "call", delta: amount, balanceAfter: balance, refId: input.requestKey }, result: balance, summary: `${label}: ${input.reason}` };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, balance: written.result, summary: label };
}

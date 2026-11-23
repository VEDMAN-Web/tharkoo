import { ValidationError } from "@/server/http";
import { SYSTEM_OWNER, accountBalance, postTransaction } from "@/server/ledger";

/**
 * H18.8 (Vedant, 21 Nov 2026): three balances per account.
 * - Ad credits (user_wallet, the old wallet): posting, TOP, Super Top. Every old balance stays here.
 * - Call credits (call_wallet): video calls only.
 * - Earnings (vendor_earnings): what users paid for calls. Withdraw, or move to ad credits (at least 100 at a time).
 */
export type WalletKind = "ad" | "call";
export const WALLET_KINDS = ["ad", "call"] as const;

export function walletKind(value: unknown): WalletKind {
  return value === "call" ? "call" : "ad";
}

/** Smallest custom amount per wallet, in rupees. */
export const CUSTOM_MIN_INR: Record<WalletKind, number> = { call: 100, ad: 1000 };
/** Largest custom amount per purchase and per day, in rupees. Above this the buyer contacts support and staff credit by hand. */
// H18.9 (Vedant): call credits stay under Rs 1,000 a purchase.
export const CUSTOM_MAX_PER_PURCHASE_INR: Record<WalletKind, number> = { call: 999, ad: 50_000 };
export const CUSTOM_MAX_PER_DAY_INR = 100_000;
/** Earnings move to ad credits in blocks of at least this many credits (the price of the smallest ad pack). */
export const MOVE_EARNINGS_MIN = 100;

export async function callBalance(userId: string) {
  return accountBalance("call_wallet", userId);
}

export async function earningsBalance(userId: string) {
  return accountBalance("vendor_earnings", userId);
}

/**
 * Credits for a custom rupee amount: the base rate, or the best pack's rate when the amount is at least that pack's
 * price (a bigger spend is never a worse deal).
 */
export function customCredits(amountInr: number, creditPriceInr: number, packs: { price: number; total: number }[]) {
  const base = Math.floor(amountInr / Math.max(1, creditPriceInr));
  const best = packs.filter((p) => p.price > 0 && p.total > 0 && amountInr >= p.price).sort((a, b) => a.price / a.total - b.price / b.total)[0];
  const atBest = best ? Math.floor(amountInr / (best.price / best.total)) : 0;
  return Math.max(base, atBest);
}

/** Adds or takes call credits. Money from outside (a payment or staff) is the counter side. */
export async function moveCallCredits(input: {
  userId: string;
  amount: number;
  key: string;
  kind: string;
  requestId: string;
  actorId?: string;
  actorType?: "user" | "admin" | "system";
  reason?: string;
}) {
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new ValidationError("Invalid request", { amount: ["Invalid amount"] });
  return postTransaction({
    idempotencyKey: input.key,
    kind: input.kind,
    refType: "call_wallet",
    refId: input.key,
    moves: [
      { account: "external", ownerKey: SYSTEM_OWNER, delta: -input.amount },
      { account: "call_wallet", ownerKey: input.userId, delta: input.amount },
    ],
    requestId: input.requestId,
    actorId: input.actorId ?? null,
    actorType: input.actorType ?? "system",
    reason: input.reason,
  });
}

/** A vendor moves earnings into ad credits. At least MOVE_EARNINGS_MIN, never more than they have. */
export async function moveEarningsToAdCredits(input: { userId: string; amount: number; idempotencyKey: string; requestId: string; ip?: string }) {
  if (!Number.isInteger(input.amount) || input.amount < MOVE_EARNINGS_MIN) {
    throw new ValidationError("Invalid request", { amount: [`Move at least ${MOVE_EARNINGS_MIN} credits at a time.`] });
  }
  if ((await earningsBalance(input.userId)) < input.amount) {
    throw new ValidationError("Invalid request", { amount: ["You do not have that many earned credits."] });
  }
  const key = `earnings-to-ad:${input.userId}:${input.idempotencyKey}`;
  await postTransaction({
    idempotencyKey: key,
    kind: "earnings_to_ad",
    refType: "user",
    refId: input.userId,
    moves: [
      { account: "vendor_earnings", ownerKey: input.userId, delta: -input.amount },
      { account: "user_wallet", ownerKey: input.userId, delta: input.amount },
    ],
    requestId: input.requestId,
    actorId: input.userId,
    actorType: "user",
    ip: input.ip,
  });
  return { moved: input.amount, earnings: await earningsBalance(input.userId), adCredits: await accountBalance("user_wallet", input.userId) };
}

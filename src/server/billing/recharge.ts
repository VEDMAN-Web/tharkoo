import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { safeNext } from "@/lib/ui/api";
import { AuditRepository } from "@/server/audit";
import { applyWebhook, checkoutPack } from "@/server/billing/service";
import { readMoneySettings } from "@/server/billing/money-settings";
import { objectId, walletBalance } from "@/server/billing/ledger";
import { livePaymentsAllowed, paymentProvider } from "@/server/billing/provider";
import { createInvoice, orderStatus, passimpayConfigured } from "@/server/billing/passimpay";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { CreditPack, Payment } from "@/server/models";
import { assertNotPaused } from "@/server/settings/emergency";

const audit = new AuditRepository();

export const RECHARGE_METHODS = ["card", "crypto"] as const;
export type RechargeMethod = (typeof RECHARGE_METHODS)[number];

export const CRYPTO_COINS = ["BTC", "ETH", "USDT", "USDC"] as const;
export type CryptoCoin = (typeof CRYPTO_COINS)[number];

export const STABLE_NETWORKS = ["TRC-20", "ERC-20", "BEP-20"] as const;
export type StableNetwork = (typeof STABLE_NETWORKS)[number];

export const CRYPTO_WINDOW_MS = 30 * 60 * 1000;
export const SHEET_PACK_LIMIT = 6;

const MOCK_RATE_INR: Record<CryptoCoin, number> = { BTC: 5_500_000, ETH: 280_000, USDT: 88, USDC: 88 };
const COIN_DECIMALS: Record<CryptoCoin, number> = { BTC: 8, ETH: 6, USDT: 2, USDC: 2 };
const ADDRESS_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type RechargePack = { id: string; credits: number; bonus: number; total: number; price: number; badge: "popular" | "best" | null };

export function packBadge(tag: string | undefined | null): RechargePack["badge"] {
  const text = (tag || "").toLowerCase();
  if (/popular/.test(text)) return "popular";
  if (/best/.test(text)) return "best";
  return null;
}

export async function rechargePacks(): Promise<RechargePack[]> {
  await connectDb();
  const rows = await CreditPack.find({ $or: [{ status: "active" }, { status: { $exists: false } }] }).lean();
  return rows
    .filter((row) => Number.isInteger(row.credits) && (row.credits ?? 0) >= 1 && Number.isFinite(row.price))
    .map((row) => {
      const credits = row.credits ?? 0;
      const bonus = row.bonus ?? 0;
      return { id: String(row._id), credits, bonus, total: credits + bonus, price: Math.round(row.price ?? 0), badge: packBadge(row.tag) };
    })
    .sort((a, b) => a.total - b.total);
}

export function sheetPacks(packs: RechargePack[], shortfall: number): RechargePack[] {
  const shown = packs.slice(0, SHEET_PACK_LIMIT);
  if (shortfall <= 0) return shown;
  const cover = packs.find((pack) => pack.total >= shortfall) ?? packs[packs.length - 1];
  if (!cover || shown.some((pack) => pack.id === cover.id)) return shown;
  return [...shown.slice(0, SHEET_PACK_LIMIT - 1), cover];
}

export function estimateCoinAmount(amountInr: number, coin: CryptoCoin): string {
  return (amountInr / MOCK_RATE_INR[coin]).toFixed(COIN_DECIMALS[coin]);
}

export function mockDepositAddress(coin: CryptoCoin, network: StableNetwork | null, seed: string): string {
  let state = 0;
  for (const char of `${coin}:${network ?? ""}:${seed}`) state = (Math.imul(state, 31) + char.charCodeAt(0)) >>> 0;
  const pick = (length: number) => {
    let out = "";
    for (let index = 0; index < length; index += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      out += ADDRESS_ALPHABET[state % ADDRESS_ALPHABET.length];
    }
    return out;
  };
  const hex = (length: number) => pick(length).toLowerCase().replace(/[^0-9a-f]/g, "a");
  if (coin === "BTC") return `bc1q${pick(34).toLowerCase()}`;
  if (network === "TRC-20") return `T${pick(33)}`;
  return `0x${hex(40)}`;
}

export function needsNetwork(coin: string): boolean {
  return coin === "USDT" || coin === "USDC";
}

export type RechargeStatus = "pending" | "paid" | "cancelled" | "expired" | "failed";

type PaymentRow = {
  _id: mongoose.Types.ObjectId;
  userId: unknown;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  provider?: string;
  providerRef?: string;
  method?: RechargeMethod;
  coin?: string;
  network?: string;
  credits?: number;
  returnTo?: string;
  expiresAt?: Date;
  outcome?: string;
  createdAt?: Date;
};

export function statusOf(row: PaymentRow, now = Date.now()): RechargeStatus {
  if (row.status === "paid") return "paid";
  if (row.status === "failed") return row.outcome === "cancelled" ? "cancelled" : row.outcome === "expired" ? "expired" : "failed";
  if (row.expiresAt && row.expiresAt.getTime() <= now) return "expired";
  return "pending";
}

export function paymentView(row: PaymentRow, now = Date.now()) {
  const id = String(row._id);
  const coin = row.coin && (CRYPTO_COINS as readonly string[]).includes(row.coin) ? (row.coin as CryptoCoin) : null;
  const network = row.network && (STABLE_NETWORKS as readonly string[]).includes(row.network) ? (row.network as StableNetwork) : null;
  return {
    id,
    method: row.method ?? "card",
    coin,
    network,
    amount: row.amount,
    currency: row.currency,
    credits: row.credits ?? 0,
    status: statusOf(row, now),
    returnTo: row.returnTo ?? "",
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    receiptNo: `TK-${id.slice(-8).toUpperCase()}`,
    cryptoAmount: coin ? estimateCoinAmount(row.amount, coin) : null,
    depositAddress: coin ? mockDepositAddress(coin, network, id) : null,
  };
}

/** H18.1: PassimPay is switched on, live payments are allowed and its keys are set. */
export function passimpayLive() {
  return paymentProvider() === "passimpay" && livePaymentsAllowed() && passimpayConfigured();
}

/** What the buy screen may offer: PassimPay when live, else the test (mock) payments when an admin turned them on. */
export async function paymentsAvailable(): Promise<boolean> {
  await connectDb();
  return passimpayLive() || (await mockPaymentsAvailable());
}

export async function mockPaymentsAvailable(): Promise<boolean> {
  await connectDb();
  return paymentProvider() === "mock" && (await readMoneySettings()).mockPaymentsOn;
}

function checkedCoin(coin: string, network: string | undefined): { coin: string; network: string | undefined } {
  if (!(CRYPTO_COINS as readonly string[]).includes(coin)) throw new ValidationError("Invalid request", { coin: ["Choose a coin"] });
  if (!needsNetwork(coin)) return { coin, network: undefined };
  if (!network || !(STABLE_NETWORKS as readonly string[]).includes(network)) throw new ValidationError("Invalid request", { network: ["Choose a network"] });
  return { coin, network };
}

export const NOT_AVAILABLE_MESSAGE = "Payments are not available right now. Nothing was charged.";

export async function startRecharge(input: {
  userId: string;
  packId: string;
  method: string;
  coin?: string;
  network?: string;
  returnTo?: string;
  idempotencyKey?: string;
  requestId: string;
  ip?: string;
}) {
  await connectDb();
  await assertNotPaused("pausePurchases");
  if (!(RECHARGE_METHODS as readonly string[]).includes(input.method)) throw new ValidationError("Invalid request", { method: ["Choose Card or Crypto"] });
  // H18.1: with PassimPay on, every recharge goes to PassimPay's hosted crypto page (the coin is chosen there).
  const passimpay = paymentProvider() === "passimpay";
  const method = (passimpay ? "crypto" : input.method) as RechargeMethod;
  if (passimpay) {
    if (!passimpayLive()) throw new ConflictError(NOT_AVAILABLE_MESSAGE);
  } else if (!(await mockPaymentsAvailable())) throw new ConflictError(NOT_AVAILABLE_MESSAGE);
  const picked = method === "crypto" && input.coin && !passimpay ? checkedCoin(input.coin, input.network) : { coin: undefined, network: undefined };
  const returnTo = input.returnTo ? safeNext(input.returnTo) ?? undefined : undefined;
  const result = await checkoutPack({
    userId: input.userId,
    packId: input.packId,
    idempotencyKey: input.idempotencyKey,
    requestId: input.requestId,
    ip: input.ip,
    recharge: { method, coin: picked.coin, network: picked.network, returnTo, expiresAt: picked.coin ? new Date(Date.now() + CRYPTO_WINDOW_MS) : undefined },
  });
  await audit.append({
    actorId: input.userId,
    actorType: "user",
    action: "recharge.start",
    targetType: "payment",
    targetId: result.paymentId,
    requestId: input.requestId,
    after: { method, coin: picked.coin ?? null, network: picked.network ?? null, provider: passimpay ? "passimpay" : "mock" },
  });
  if (passimpay) return { paymentId: result.paymentId, checkoutPath: await passimpayInvoiceUrl(result.paymentId) };
  return { paymentId: result.paymentId, checkoutPath: `/pay/checkout/${result.paymentId}/` };
}

/** H18.1: the PassimPay page for a payment. Made once and kept on the payment, so a repeated request reuses it. */
async function passimpayInvoiceUrl(paymentId: string) {
  const row = await Payment.findById(paymentId).lean<(PaymentRow & { invoiceUrl?: string }) | null>();
  if (!row) throw new NotFoundError("Not found");
  if (row.invoiceUrl) return row.invoiceUrl;
  try {
    const { url } = await createInvoice({ orderId: paymentId, amountInr: row.amount });
    await Payment.updateOne({ _id: row._id }, { $set: { invoiceUrl: url } }, { strict: false });
    return url;
  } catch {
    await Payment.updateOne({ _id: row._id, status: "pending" }, { $set: { status: "failed", outcome: "error" } });
    throw new ConflictError(NOT_AVAILABLE_MESSAGE);
  }
}

/**
 * H18.1: settles a pending PassimPay payment by asking PassimPay (orderStatus). Only "paid" adds credits, through the same
 * applyWebhook path as every other payment (idempotent: one credit per payment). A rupee amount below the price is not credited.
 * Called by the PassimPay notice, and when the buyer opens their payment or history (in case a notice was lost).
 */
export async function settlePassimpay(paymentId: string, requestId: string): Promise<"paid" | "wait" | "failed" | "ignored"> {
  await connectDb();
  if (!mongoose.isValidObjectId(paymentId)) return "ignored";
  const row = await Payment.findById(paymentId).lean<PaymentRow | null>();
  if (!row || row.provider !== "passimpay" || !row.providerRef) return "ignored";
  if (row.status === "paid") return "paid";
  if (row.status !== "pending") return "failed";
  const result = await orderStatus(row.providerRef);
  if (result.status === "wait") return "wait";
  if (result.status === "paid") {
    if (result.currency === "INR" && result.amountPaid + 0.005 < row.amount) {
      await audit.append({ actorId: null, actorType: "system", action: "recharge.passimpay_underpaid", targetType: "payment", targetId: paymentId, requestId, after: { amountPaid: result.amountPaid, amount: row.amount } });
      return "wait";
    }
    await applyWebhook({ eventId: `passimpay_${paymentId}`, status: "paid", providerRef: row.providerRef }, requestId);
    await Payment.updateOne({ _id: row._id, status: "paid" }, { $set: { outcome: "paid" } });
    await audit.append({ actorId: null, actorType: "system", action: "recharge.passimpay_paid", targetType: "payment", targetId: paymentId, requestId, after: { currency: result.currency || null } });
    return "paid";
  }
  await applyWebhook({ eventId: `passimpay_${paymentId}_error`, status: "failed", providerRef: row.providerRef }, requestId);
  await Payment.updateOne({ _id: row._id, status: "failed" }, { $set: { outcome: "expired" } });
  return "failed";
}

/** Best effort: a provider hiccup never breaks the page that shows the payment. */
async function trySettle(row: PaymentRow, requestId: string) {
  if (row.provider !== "passimpay" || row.status !== "pending") return;
  await settlePassimpay(String(row._id), requestId).catch(() => undefined);
}

async function ownPayment(userId: string, paymentId: string) {
  if (!mongoose.isValidObjectId(paymentId)) throw new NotFoundError("Not found");
  await connectDb();
  const row = await Payment.findById(paymentId).lean<PaymentRow | null>();
  if (!row || String(row.userId) !== userId || !row.method) throw new NotFoundError("Not found");
  return row;
}

export async function readOwnPayment(userId: string, paymentId: string) {
  await connectDb();
  const row = await ownPayment(userId, paymentId);
  if (row.provider === "passimpay" && row.status === "pending") {
    await trySettle(row, `view-${paymentId}`);
    return paymentView(await ownPayment(userId, paymentId));
  }
  return paymentView(row);
}

export async function listOwnPayments(userId: string, page: number, pageSize: number) {
  await connectDb();
  const filter = { userId: objectId(userId, "userId"), method: { $in: [...RECHARGE_METHODS] } };
  // H18.1: settle the buyer's newest pending PassimPay payments first, in case a notice was lost.
  const pending = await Payment.find({ ...filter, provider: "passimpay", status: "pending" }).sort({ _id: -1 }).limit(3).lean<PaymentRow[]>();
  for (const row of pending) await trySettle(row, `history-${String(row._id)}`);
  const [rows, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<PaymentRow[]>(),
    Payment.countDocuments(filter),
  ]);
  return { items: rows.map((row) => paymentView(row)), total };
}

export async function chooseCoin(input: { userId: string; paymentId: string; coin: string; network?: string; requestId: string }) {
  await connectDb();
  const row = await ownPayment(input.userId, input.paymentId);
  if (row.method !== "crypto") throw new ConflictError("This payment is not a crypto payment");
  const picked = checkedCoin(input.coin, input.network);
  if (statusOf(row) !== "pending") throw new ConflictError("This payment is closed. Nothing was charged.");
  const expiresAt = row.expiresAt && row.coin ? row.expiresAt : new Date(Date.now() + CRYPTO_WINDOW_MS);
  const set: Record<string, unknown> = { coin: picked.coin, expiresAt };
  if (picked.network) set.network = picked.network;
  await Payment.updateOne({ _id: row._id, status: "pending" }, picked.network ? { $set: set } : { $set: set, $unset: { network: "" } });
  return readOwnPayment(input.userId, input.paymentId);
}

export type MockOutcome = "paid" | "cancelled";

export async function confirmMockPayment(input: { userId: string; paymentId: string; outcome: string; requestId: string }) {
  await connectDb();
  if (input.outcome !== "paid" && input.outcome !== "cancelled") throw new ValidationError("Invalid request", { outcome: ["Invalid outcome"] });
  const row = await ownPayment(input.userId, input.paymentId);
  if (row.provider !== "mock" || !row.providerRef) throw new ForbiddenError("This payment cannot be confirmed here");
  if (!(await mockPaymentsAvailable())) throw new ConflictError(NOT_AVAILABLE_MESSAGE);
  const current = statusOf(row);
  if (current === "paid") return { payment: paymentView(row), balance: await walletBalance(input.userId) };
  if (current === "expired") {
    await Payment.updateOne({ _id: row._id, status: "pending" }, { $set: { status: "failed", outcome: "expired" } });
    throw new ConflictError("This payment window has ended. Nothing was charged.");
  }
  if (current !== "pending") throw new ConflictError("This payment is closed. Nothing was charged.");
  const paid = input.outcome === "paid";
  await applyWebhook(
    {
      eventId: `mock_${input.paymentId}_${input.outcome}`,
      status: paid ? "paid" : "failed",
      amount: row.amount,
      currency: row.currency,
      providerRef: row.providerRef,
    },
    input.requestId,
  );
  if (paid) await Payment.updateOne({ _id: row._id, status: "paid" }, { $set: { outcome: "paid" } });
  else await Payment.updateOne({ _id: row._id, status: "failed" }, { $set: { outcome: "cancelled" } });
  await audit.append({
    actorId: input.userId,
    actorType: "user",
    action: paid ? "recharge.mock_paid" : "recharge.mock_cancelled",
    targetType: "payment",
    targetId: input.paymentId,
    requestId: input.requestId,
    after: { method: row.method ?? null },
  });
  const fresh = await Payment.findById(row._id).lean<PaymentRow>();
  return { payment: paymentView(fresh ?? row), balance: await walletBalance(input.userId) };
}

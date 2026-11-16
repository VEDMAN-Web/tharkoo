import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { safeNext } from "@/lib/ui/api";
import { AuditRepository } from "@/server/audit";
import { applyWebhook, checkoutPack } from "@/server/billing/service";
import { readMoneySettings } from "@/server/billing/money-settings";
import { objectId, walletBalance } from "@/server/billing/ledger";
import { paymentProvider } from "@/server/billing/provider";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { CreditPack, Payment } from "@/server/models";

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

export async function mockPaymentsAvailable(): Promise<boolean> {
  return paymentProvider() === "mock" && (await readMoneySettings()).mockPaymentsOn;
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
  if (!(RECHARGE_METHODS as readonly string[]).includes(input.method)) throw new ValidationError("Invalid request", { method: ["Choose Card or Crypto"] });
  const method = input.method as RechargeMethod;
  let coin: string | undefined;
  let network: string | undefined;
  if (method === "crypto") {
    if (!input.coin || !(CRYPTO_COINS as readonly string[]).includes(input.coin)) throw new ValidationError("Invalid request", { coin: ["Choose a coin"] });
    coin = input.coin;
    if (needsNetwork(coin)) {
      if (!input.network || !(STABLE_NETWORKS as readonly string[]).includes(input.network)) throw new ValidationError("Invalid request", { network: ["Choose a network"] });
      network = input.network;
    }
  }
  if (!(await mockPaymentsAvailable())) throw new ConflictError(NOT_AVAILABLE_MESSAGE);
  const returnTo = input.returnTo ? safeNext(input.returnTo) ?? undefined : undefined;
  const result = await checkoutPack({
    userId: input.userId,
    packId: input.packId,
    idempotencyKey: input.idempotencyKey,
    requestId: input.requestId,
    ip: input.ip,
    recharge: { method, coin, network, returnTo, expiresAt: method === "crypto" ? new Date(Date.now() + CRYPTO_WINDOW_MS) : undefined },
  });
  await audit.append({
    actorId: input.userId,
    actorType: "user",
    action: "recharge.start",
    targetType: "payment",
    targetId: result.paymentId,
    requestId: input.requestId,
    after: { method, coin: coin ?? null, network: network ?? null },
  });
  return { paymentId: result.paymentId, checkoutPath: `/pay/checkout/${result.paymentId}/` };
}

async function ownPayment(userId: string, paymentId: string) {
  if (!mongoose.isValidObjectId(paymentId)) throw new NotFoundError("Not found");
  await connectDb();
  const row = await Payment.findById(paymentId).lean<PaymentRow | null>();
  if (!row || String(row.userId) !== userId || !row.method) throw new NotFoundError("Not found");
  return row;
}

export async function readOwnPayment(userId: string, paymentId: string) {
  return paymentView(await ownPayment(userId, paymentId));
}

export async function listOwnPayments(userId: string, page: number, pageSize: number) {
  await connectDb();
  const filter = { userId: objectId(userId, "userId"), method: { $in: [...RECHARGE_METHODS] } };
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

export type MockOutcome = "paid" | "cancelled";

export async function confirmMockPayment(input: { userId: string; paymentId: string; outcome: string; requestId: string }) {
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

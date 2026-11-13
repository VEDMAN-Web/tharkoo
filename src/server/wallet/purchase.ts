import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { objectId } from "@/server/billing/ledger";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http";
import { SYSTEM_OWNER } from "@/server/ledger/accounts";
import { postTransaction } from "@/server/ledger/service";
import { CreditPack } from "@/server/models";
import { randomToken } from "@/server/shared/crypto";
import { CoinPurchase } from "@/server/wallet/models";
import { coinProvider, providerEventSchema, type ProviderEvent } from "@/server/wallet/provider";
import { getFinanceSettings } from "@/server/wallet/settings";

const audit = new AuditRepository();

function present(row: {
  _id?: unknown;
  coins: number;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  tdsPercent: number;
  gstPercent: number;
  createdAt?: Date;
}) {
  return {
    id: String(row._id),
    coins: row.coins,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    tdsPercent: row.tdsPercent,
    gstPercent: row.gstPercent,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

/** The coin packs a user can buy. These are the existing credit packs: credits are coins. */
export async function listCoinPacks() {
  await connectDb();
  const [rows, settings] = await Promise.all([
    CreditPack.find({ $or: [{ status: "active" }, { status: { $exists: false } }] })
      .sort({ order: 1, credits: 1 })
      .lean(),
    getFinanceSettings(),
  ]);
  return {
    coinValueInr: settings.coinValueInr,
    tdsPercent: settings.tdsPercent,
    gstPercent: settings.gstPercent,
    packs: rows
      .filter((row) => Number.isInteger(row.credits) && (row.credits ?? 0) >= 1)
      .map((row) => ({
        id: String(row._id),
        coins: (row.credits ?? 0) + (row.bonus ?? 0),
        price: Math.round(row.price ?? (row.credits ?? 0) * settings.coinValueInr),
        tag: row.tag ?? null,
      })),
  };
}

/** Starts a purchase. It credits nothing: coins arrive only from a verified provider webhook. */
export async function startCoinPurchase(input: {
  userId: string;
  packId: string;
  idempotencyKey?: string;
  requestId: string;
  ip?: string;
}) {
  await connectDb();
  await CoinPurchase.init();
  const userId = objectId(input.userId, "userId");
  const packId = objectId(input.packId, "packId");
  const idempotencyKey = input.idempotencyKey?.trim() || randomToken();
  const existing = await CoinPurchase.findOne({ idempotencyKey }).lean();
  if (existing) {
    if (String(existing.userId) !== input.userId) throw new ConflictError("Idempotency key is in use");
    return { ...present(existing), providerPaymentId: existing.providerPaymentId, checkoutUrl: null, created: false };
  }
  const pack = await CreditPack.findById(packId).lean();
  if (!pack || (pack.status && pack.status !== "active")) throw new NotFoundError("Not found");
  const coins = (pack.credits ?? 0) + (pack.bonus ?? 0);
  const settings = await getFinanceSettings();
  const amount = Math.round(pack.price ?? (pack.credits ?? 0) * settings.coinValueInr);
  if (!Number.isInteger(coins) || coins < 1 || amount < 1) throw new NotFoundError("Not found");
  const provider = coinProvider();
  const purchaseId = String(new mongoose.Types.ObjectId());
  const created = provider.createPayment({ purchaseId, amount, currency: "INR" });
  const row = await CoinPurchase.create({
    _id: purchaseId,
    userId,
    packId,
    idempotencyKey,
    provider: provider.name,
    providerPaymentId: created.providerPaymentId,
    coins,
    amount,
    currency: "INR",
    status: "pending",
    tdsPercent: settings.tdsPercent,
    gstPercent: settings.gstPercent,
  });
  await audit.append({
    actorId: input.userId,
    actorType: "user",
    action: "coins.purchase.start",
    targetType: "coin_purchase",
    targetId: purchaseId,
    requestId: input.requestId,
    after: { packId: input.packId, coins, amount, provider: provider.name },
  });
  return {
    ...present(row.toObject()),
    providerPaymentId: created.providerPaymentId,
    checkoutUrl: created.checkoutUrl,
    created: true,
  };
}

export async function listCoinPurchases(userId: string, page: number, pageSize: number) {
  await connectDb();
  const filter = { userId: objectId(userId, "userId") };
  const [rows, total] = await Promise.all([
    CoinPurchase.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    CoinPurchase.countDocuments(filter),
  ]);
  return { items: rows.map(present), total };
}

function moves(userId: string, coins: number, direction: 1 | -1) {
  return [
    { account: "external" as const, ownerKey: SYSTEM_OWNER, delta: -coins * direction },
    { account: "user_wallet" as const, ownerKey: userId, delta: coins * direction },
  ];
}

/**
 * Applies a verified provider event. The signature and timestamp are checked by the caller before this runs.
 * Only the delivery that moves a purchase out of its previous status acts, so a replay changes nothing.
 */
export async function applyCoinEvent(raw: unknown, requestId: string) {
  await connectDb();
  await CoinPurchase.init();
  const parsed = providerEventSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Invalid request", { body: ["Invalid event"] });
  const event: ProviderEvent = parsed.data;
  const purchase = await CoinPurchase.findOne({ providerPaymentId: event.providerPaymentId }).lean();
  if (!purchase) throw new NotFoundError("Not found");
  if (event.amount !== undefined && event.amount !== purchase.amount) throw new ConflictError("Amount does not match");
  if (event.currency && event.currency.toUpperCase() !== purchase.currency) throw new ConflictError("Currency does not match");
  const userId = String(purchase.userId);
  const id = String(purchase._id);

  if (event.status === "failed") {
    await CoinPurchase.updateOne({ _id: purchase._id, status: "pending" }, { $set: { status: "failed", eventId: event.eventId } });
    return { received: true as const };
  }
  if (event.status === "succeeded") {
    const claim = await CoinPurchase.findOneAndUpdate(
      { _id: purchase._id, status: { $in: ["pending", "failed"] } },
      { $set: { status: "succeeded", eventId: event.eventId } },
      { returnDocument: "before" },
    ).lean();
    if (!claim) return { received: true as const };
    try {
      await postTransaction({
        idempotencyKey: `coin-buy:${id}`,
        kind: "coin_purchase",
        refType: "coin_purchase",
        refId: id,
        moves: moves(userId, purchase.coins, 1),
        requestId,
        actorType: "system",
      });
    } catch (error) {
      await CoinPurchase.updateOne({ _id: purchase._id, status: "succeeded", eventId: event.eventId }, { $set: { status: claim.status } });
      throw error;
    }
    return { received: true as const };
  }
  // refunded: only a purchase that was paid can be refunded, and only if the coins are still there.
  const claim = await CoinPurchase.findOneAndUpdate(
    { _id: purchase._id, status: "succeeded" },
    { $set: { status: "refunded", eventId: event.eventId } },
    { returnDocument: "before" },
  ).lean();
  if (!claim) return { received: true as const };
  try {
    await postTransaction({
      idempotencyKey: `coin-refund:${id}`,
      kind: "coin_refund",
      refType: "coin_purchase",
      refId: id,
      moves: moves(userId, purchase.coins, -1),
      requestId,
      actorType: "system",
    });
  } catch (error) {
    await CoinPurchase.updateOne({ _id: purchase._id, status: "refunded", eventId: event.eventId }, { $set: { status: "succeeded" } });
    throw error;
  }
  return { received: true as const };
}

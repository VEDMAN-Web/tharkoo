import type { Types } from "mongoose";
import { AuditRepository } from "@/server/audit";
import { STAR_SLOT_CAP, boostsDue, promotionRule } from "@/server/billing/catalog";
import { consumeCoupon, packBonus, promotionCost, validateCoupon } from "@/server/billing/coupons";
import {
  creditWallet,
  debitWallet,
  objectId,
  readyBilling,
  walletBalance,
} from "@/server/billing/ledger";
import { createCheckoutOrder, paymentProvider } from "@/server/billing/provider";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PaymentRequiredError,
  PolicyViolationError,
  ValidationError,
} from "@/server/http";
import {
  AuditEvent,
  CreditPack,
  Listing,
  Payment,
  PromotionOrder,
  PromotionProduct,
  WalletEntry,
} from "@/server/models";
import { productCodeDenied } from "@/server/shared/policy";
import { randomToken, sha256 } from "@/server/shared/crypto";

const audit = new AuditRepository();

function presentOrder(
  order: { _id?: Types.ObjectId; startsAt?: Date; endsAt?: Date },
  paymentId: string,
  balance: number,
) {
  return {
    orderId: String(order._id),
    paymentId,
    startsAt: order.startsAt ? order.startsAt.toISOString() : null,
    endsAt: order.endsAt ? order.endsAt.toISOString() : null,
    balance,
  };
}

async function starCount(cityId: Types.ObjectId, productId: Types.ObjectId) {
  const listings = await Listing.find({ cityId }).select("_id").lean();
  if (listings.length === 0) return 0;
  return PromotionOrder.countDocuments({
    productId,
    listingId: { $in: listings.map((row) => row._id) },
    status: { $in: ["pending", "active"] },
    endsAt: { $gt: new Date() },
  });
}

export async function listProducts() {
  await readyBilling();
  const rows = await PromotionProduct.find({ enabled: { $ne: false } }).sort({ amount: 1 }).lean();
  const products = [];
  for (const row of rows) {
    if (productCodeDenied(row.code).denied) continue;
    const rule = promotionRule(row.code, undefined, row.durationDays);
    products.push({
      id: String(row._id),
      code: row.code,
      name: row.name,
      description: row.description,
      amount: row.amount,
      currency: row.currency,
      durationDays: rule.durationDays,
      schedule: {
        durationMs: rule.durationMs,
        boosts: rule.boosts,
        intervalMs: rule.intervalMs,
        slotCap: row.code === "star" ? STAR_SLOT_CAP : null,
      },
    });
  }
  return { products };
}

export async function listOrders(userId: string, page: number, pageSize: number) {
  await readyBilling();
  const id = objectId(userId, "userId");
  const filter = { userId: id };
  const [rows, total] = await Promise.all([
    PromotionOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    PromotionOrder.countDocuments(filter),
  ]);
  return {
    items: rows.map((row) => ({
      id: String(row._id),
      listingId: String(row.listingId),
      productId: String(row.productId),
      status: row.status,
      durationDays: row.durationDays,
      startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null,
      endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
    })),
    total,
  };
}

export async function checkoutPack(input: {
  userId: string;
  packId: string;
  idempotencyKey?: string;
  couponCode?: string;
  requestId: string;
  ip?: string;
}) {
  await readyBilling();
  const userId = objectId(input.userId, "userId");
  const packId = objectId(input.packId, "packId");
  const idempotencyKey = input.idempotencyKey?.trim() || randomToken();
  const existing = await Payment.findOne({ idempotencyKey });
  if (existing) {
    if (existing.userId.toString() !== input.userId) throw new ConflictError("Idempotency key is in use");
    return {
      paymentId: String(existing._id),
      providerRef: existing.providerRef ?? "",
      balance: await walletBalance(input.userId),
      provider: existing.provider === "razorpay" ? ("razorpay" as const) : ("mock" as const),
    };
  }
  const pack = await CreditPack.findById(packId);
  if (!pack || (pack.status && pack.status !== "active")) throw new NotFoundError("Not found");
  const credits = pack.credits ?? 0;
  const price = Math.round(pack.price ?? 0);
  if (!Number.isInteger(credits) || credits < 1 || !Number.isInteger(price) || price < 0) {
    throw new NotFoundError("Not found");
  }
  const quote = input.couponCode ? await validateCoupon(input.couponCode, input.userId) : null;
  const bonusCredits = quote ? packBonus(quote, credits) : 0;
  const payment = await Payment.create({
    userId,
    orderId: pack._id,
    idempotencyKey,
    provider: paymentProvider(),
    amount: price,
    currency: "INR",
    status: "pending",
  });
  try {
    const order = createCheckoutOrder({ amount: price, currency: "INR", receipt: String(payment._id) });
    payment.provider = order.provider;
    payment.providerRef = order.providerRef;
    await payment.save();
    if (quote) await consumeCoupon(quote, input.userId, input.requestId, input.ip);
    await audit.append({
      actorId: input.userId,
      actorType: "user",
      action: "payment.checkout",
      targetType: "payment",
      targetId: String(payment._id),
      requestId: input.requestId,
      after: {
        packId: input.packId,
        provider: order.provider,
        bonusCredits,
        couponId: quote ? String(quote._id) : null,
      },
    });
    return {
      paymentId: String(payment._id),
      providerRef: order.providerRef,
      balance: await walletBalance(input.userId),
      provider: order.provider,
    };
  } catch (error) {
    await Payment.deleteOne({ _id: payment._id });
    throw error;
  }
}

/** Records a webhook that was refused. Only the reason is stored: never the body, the signature or the secret. */
export async function recordWebhookRejection(reason: string, requestId: string) {
  await readyBilling();
  await audit.append({
    actorId: null,
    actorType: "system",
    action: "payment.webhook.rejected",
    targetType: "webhook",
    targetId: "payments",
    after: { reason },
    requestId,
  });
}

export async function applyWebhook(
  body: {
    eventId: string;
    idempotencyKey?: string;
    status: "pending" | "paid" | "failed";
    amount?: number;
    currency?: string;
    providerRef?: string;
  },
  requestId: string,
) {
  await readyBilling();
  const payment = body.providerRef
    ? await Payment.findOne({ providerRef: body.providerRef })
    : body.idempotencyKey
      ? await Payment.findOne({ idempotencyKey: body.idempotencyKey })
      : null;
  if (!payment || payment.provider === "wallet") throw new NotFoundError("Not found");
  if (body.amount !== undefined && body.amount !== payment.amount) {
    throw new ConflictError("Amount does not match");
  }
  if (body.currency && body.currency.toUpperCase() !== payment.currency) {
    throw new ConflictError("Currency does not match");
  }
  if (body.status !== "paid") {
    if (payment.status === "pending") {
      payment.status = "failed";
      payment.providerEventId = body.eventId;
      await payment.save();
    }
    return { received: true as const };
  }
  if (payment.status === "paid" || payment.providerEventId === body.eventId) {
    return { received: true as const };
  }
  const pack = await CreditPack.findById(payment.orderId);
  if (!pack) throw new NotFoundError("Not found");
  const checkout = await AuditEvent.findOne({ action: "payment.checkout", targetId: String(payment._id) })
    .sort({ _id: -1 })
    .lean();
  const couponBonus =
    checkout?.after && typeof checkout.after.bonusCredits === "number" ? checkout.after.bonusCredits : 0;
  const userId = String(payment.userId);
  const credits = pack.credits ?? 0;
  const bonus = pack.bonus ?? 0;
  if (credits > 0) {
    await creditWallet({
      userId,
      amount: credits,
      refType: "pack",
      refId: String(payment._id),
      requestId,
      actorId: userId,
      actorType: "system",
    });
  }
  if (bonus > 0) {
    await creditWallet({
      userId,
      amount: bonus,
      refType: "pack_bonus",
      refId: `${payment._id}:bonus`,
      requestId,
      actorId: userId,
      actorType: "system",
    });
  }
  if (couponBonus > 0) {
    await creditWallet({
      userId,
      amount: couponBonus,
      refType: "coupon",
      refId: `${payment._id}:coupon`,
      requestId,
      actorId: userId,
      actorType: "system",
    });
  }
  if (payment.status === "pending" || payment.status === "failed") {
    payment.status = "paid";
    payment.providerEventId = body.eventId;
    await payment.save();
  }
  return { received: true as const };
}

export async function purchasePromotion(input: {
  userId: string;
  listingId: string;
  productId: string;
  durationDays?: number;
  idempotencyKey?: string;
  couponCode?: string;
  startsAt?: string;
  autoRenew?: boolean;
  requestId: string;
  ip?: string;
}) {
  await readyBilling();
  const userId = objectId(input.userId, "userId");
  const listingId = objectId(input.listingId, "listingId");
  const productId = objectId(input.productId, "productId");
  const idempotencyKey = input.idempotencyKey?.trim() || randomToken();
  const existingPayment = await Payment.findOne({ idempotencyKey });
  if (existingPayment) {
    if (existingPayment.userId.toString() !== input.userId) throw new ConflictError("Idempotency key is in use");
    if (existingPayment.status === "paid" && existingPayment.provider === "wallet") {
      const order = await PromotionOrder.findById(existingPayment.orderId);
      if (order) return presentOrder(order, String(existingPayment._id), await walletBalance(input.userId));
    }
    throw new ConflictError("Checkout is already in progress");
  }

  const listing = await Listing.findById(listingId);
  if (!listing) throw new NotFoundError("Not found");
  if (listing.ownerId.toString() !== input.userId) throw new ForbiddenError("Forbidden");
  if (listing.status !== "active") throw new ConflictError("Listing is not active");
  const product = await PromotionProduct.findById(productId);
  if (!product || product.enabled === false) throw new NotFoundError("Not found");
  if (productCodeDenied(product.code).denied) throw new PolicyViolationError("Product is not allowed");
  if (product.code === "star") {
    if (!listing.cityId) throw new ConflictError("Star slots are full");
    if ((await starCount(listing.cityId, product._id)) >= STAR_SLOT_CAP) {
      throw new ConflictError("Star slots are full");
    }
  }
  const price = Math.round(product.amount);
  if (!Number.isInteger(price) || price < 0) {
    throw new ValidationError("Invalid request", { productId: ["Invalid price"] });
  }
  const quote = input.couponCode ? await validateCoupon(input.couponCode, input.userId) : null;
  const cost = promotionCost(price, quote);
  const balance = await walletBalance(input.userId);
  if (cost > balance) throw new PaymentRequiredError("Insufficient credits");
  const rule = promotionRule(product.code, input.durationDays, product.durationDays);
  const now = new Date();
  const requested = input.startsAt ? new Date(input.startsAt) : now;
  if (Number.isNaN(requested.getTime())) {
    throw new ValidationError("Invalid request", { startsAt: ["Choose a valid start time"] });
  }
  const latest = now.getTime() + 30 * 24 * 60 * 60 * 1000;
  if (requested.getTime() > latest) {
    throw new ValidationError("Invalid request", { startsAt: ["Schedule within 30 days"] });
  }
  const startsAt = requested.getTime() < now.getTime() ? now : requested;
  const endsAt = new Date(startsAt.getTime() + rule.durationMs);
  const order = await PromotionOrder.create({
    userId,
    listingId,
    productId,
    status: "pending",
    durationDays: rule.durationDays,
    startsAt,
    endsAt,
    autoRenew: input.autoRenew === true,
  });
  const payment = await Payment.create({
    userId,
    orderId: order._id,
    idempotencyKey,
    provider: "wallet",
    amount: cost,
    currency: "CRD",
    status: "pending",
  });
  let charged = false;
  try {
    if (cost > 0) {
      await debitWallet({
        userId: input.userId,
        amount: cost,
        refType: "promotion",
        refId: String(order._id),
        requestId: input.requestId,
        actorId: input.userId,
        ip: input.ip,
      });
      charged = true;
    }
    if (quote) await consumeCoupon(quote, input.userId, input.requestId, input.ip);
    order.status = "active";
    await order.save();
    if (product.code === "bump" && startsAt.getTime() <= Date.now() + 1000) {
      await Listing.collection.updateOne({ _id: listingId }, { $set: { bumpedAt: startsAt } });
    }
    payment.status = "paid";
    await payment.save();
    await audit.append({
      actorId: input.userId,
      actorType: "user",
      action: "promotion.activate",
      targetType: "promotion",
      targetId: String(order._id),
      requestId: input.requestId,
      after: {
        listingId: input.listingId,
        productCode: product.code,
        credits: cost,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      },
    });
    return presentOrder(order, String(payment._id), await walletBalance(input.userId));
  } catch (error) {
    order.status = "failed";
    await order.save();
    payment.status = "failed";
    await payment.save();
    if (charged) {
      await creditWallet({
        userId: input.userId,
        amount: cost,
        refType: "promotion_reversal",
        refId: `${order._id}:reversal`,
        requestId: input.requestId,
        actorId: input.userId,
        ip: input.ip,
      });
    }
    throw error;
  }
}

export async function refundPayment(input: {
  actorId: string;
  roles: string[];
  paymentId: string;
  amount: number;
  reason: string;
  requestId: string;
  ip?: string;
}) {
  await readyBilling();
  if (!input.roles.includes("superadmin") && !input.roles.includes("finance")) {
    throw new ForbiddenError("Forbidden");
  }
  const payment = await Payment.findById(objectId(input.paymentId, "paymentId"));
  if (!payment) throw new NotFoundError("Not found");
  if (payment.provider === "wallet" || payment.status !== "paid") {
    throw new ConflictError("Payment is not refundable");
  }
  const id = String(payment._id);
  const userId = String(payment.userId);
  const grantedRows = await WalletEntry.find({
    userId: payment.userId,
    refId: { $in: [id, `${id}:bonus`, `${id}:coupon`] },
  }).lean();
  const granted = grantedRows.reduce((sum, row) => sum + Math.max(0, row.delta), 0);
  const refunds = await WalletEntry.find({ userId: payment.userId, refType: "refund" }).lean();
  const already = refunds
    .filter((row) => row.refId.startsWith(`${id}#`))
    .reduce((sum, row) => sum + row.delta, 0);
  if (already + input.amount > granted) throw new ConflictError("Refund exceeds the credited amount");
  const refId = `${id}#${input.amount}#${sha256(input.reason).slice(0, 16)}`;
  const result = await creditWallet({
    userId,
    amount: input.amount,
    reason: "refund",
    refType: "refund",
    refId,
    requestId: input.requestId,
    actorId: input.actorId,
    actorType: "admin",
    auditAction: "wallet.refund",
    auditReason: input.reason,
    ip: input.ip,
  });
  if (!result.created) throw new ConflictError("Refund already exists");
  return { refundId: refId, balance: result.balance };
}

export async function runBoostCron(requestId: string, now = new Date()) {
  await readyBilling();
  const ended = await PromotionOrder.find({ status: "active", endsAt: { $lte: now } });
  let expired = 0;
  for (const order of ended) {
    order.status = "failed";
    await order.save();
    expired += 1;
    await audit.append({
      actorId: null,
      actorType: "worker",
      action: "promotion.expire",
      targetType: "promotion",
      targetId: String(order._id),
      requestId,
      after: { status: "failed", endsAt: order.endsAt ? order.endsAt.toISOString() : null },
    });
  }
  const active = await PromotionOrder.find({ status: "active", endsAt: { $gt: now } });
  let boosted = 0;
  for (const order of active) {
    const product = await PromotionProduct.findById(order.productId).lean();
    if (!product || !order.startsAt) continue;
    if (product.code === "bump" && order.startsAt.getTime() <= now.getTime()) {
      await Listing.collection.updateOne(
        { _id: order.listingId, $or: [{ bumpedAt: { $exists: false } }, { bumpedAt: { $lt: order.startsAt } }] },
        { $set: { bumpedAt: order.startsAt } },
      );
    }
    const due = boostsDue(product.code, order.durationDays, order.startsAt, now);
    const applied = await AuditEvent.countDocuments({
      action: "listing.boost",
      targetId: String(order._id),
    });
    const missing = due - applied;
    if (missing <= 0) continue;
    await Listing.collection.updateOne({ _id: order.listingId }, { $set: { bumpedAt: now } });
    for (let slot = 0; slot < missing; slot += 1) {
      await audit.append({
        actorId: null,
        actorType: "worker",
        action: "listing.boost",
        targetType: "promotion",
        targetId: String(order._id),
        requestId,
        after: {
          listingId: String(order.listingId),
          bumpedAt: now.toISOString(),
          slot: applied + slot,
        },
      });
      boosted += 1;
    }
  }
  return { boosted, expired };
}

export async function renewDuePromotions(requestId: string) {
  await readyBilling();
  const due = await PromotionOrder.find({ status: "active", autoRenew: true, endsAt: { $lte: new Date() } }).limit(40);
  let renewed = 0;
  for (const order of due) {
    const product = await PromotionProduct.findById(order.productId);
    if (!product) {
      order.autoRenew = false;
      await order.save();
      continue;
    }
    const cost = Math.max(0, Math.round(product.amount));
    const balance = await walletBalance(String(order.userId));
    if (cost > balance) {
      order.autoRenew = false;
      await order.save();
      continue;
    }
    try {
      if (cost > 0) {
        await debitWallet({
          userId: String(order.userId),
          amount: cost,
          refType: "promotion",
          refId: `${order._id}:renew:${order.endsAt?.toISOString() ?? renewed}`,
          requestId,
          actorId: String(order.userId),
        });
      }
      const rule = promotionRule(product.code, order.durationDays, product.durationDays);
      const start = new Date();
      order.startsAt = start;
      order.endsAt = new Date(start.getTime() + rule.durationMs);
      await order.save();
      if (product.code === "bump") {
        await Listing.collection.updateOne({ _id: order.listingId }, { $set: { bumpedAt: start } });
      }
      renewed += 1;
    } catch {
      order.autoRenew = false;
      await order.save();
    }
  }
  return { renewed };
}

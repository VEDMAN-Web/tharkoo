import type { Types } from "mongoose";
import { AuditRepository } from "@/server/audit";
import { ConflictError, NotFoundError } from "@/server/http";
import { AuditEvent, Coupon, type CouponDoc } from "@/server/models";
import { creditWallet, readyBilling } from "@/server/billing/ledger";
import { hashIp } from "@/server/shared/crypto";

const audit = new AuditRepository();

export interface CouponQuote {
  _id: Types.ObjectId;
  kind?: CouponDoc["kind"];
  percent?: number | null;
  credits?: number | null;
  maxRedemptions?: number | null;
  perUserLimit?: number | null;
  redeemedCount?: number;
  status?: string;
  expiresAt?: Date | null;
  expiry?: string | null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isExpired(coupon: CouponQuote, now = new Date()) {
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return true;
  if (coupon.expiry && /^\d{4}-\d{2}-\d{2}$/.test(coupon.expiry)) {
    return new Date(`${coupon.expiry}T23:59:59.999Z`).getTime() < now.getTime();
  }
  return false;
}

async function findCoupon(code: string) {
  const pattern = new RegExp(`^${escapeRegex(code.trim())}$`, "i");
  return Coupon.findOne({ code: pattern });
}

async function assertUsable(coupon: CouponQuote, userId: string) {
  if (coupon.status !== "active") throw new NotFoundError("Coupon is invalid");
  if (coupon.kind !== "percent" && coupon.kind !== "credits") throw new NotFoundError("Coupon is invalid");
  if (coupon.kind === "percent" && (coupon.percent == null || coupon.percent <= 0 || coupon.percent > 100)) {
    throw new NotFoundError("Coupon is invalid");
  }
  if (coupon.kind === "credits" && (coupon.credits == null || coupon.credits <= 0)) {
    throw new NotFoundError("Coupon is invalid");
  }
  if (isExpired(coupon)) throw new ConflictError("Coupon is expired");
  if (coupon.maxRedemptions != null && (coupon.redeemedCount ?? 0) >= coupon.maxRedemptions) {
    throw new ConflictError("Coupon is used up");
  }
  if (coupon.perUserLimit != null) {
    const used = await AuditEvent.countDocuments({
      action: "coupon.redeem",
      targetId: String(coupon._id),
      actorId: userId,
    });
    if (used >= coupon.perUserLimit) throw new ConflictError("Coupon is used up");
  }
}

export async function validateCoupon(code: string, userId: string) {
  await readyBilling();
  const coupon = await findCoupon(code);
  if (!coupon) throw new NotFoundError("Coupon is invalid");
  await assertUsable(coupon, userId);
  return coupon;
}

export async function consumeCoupon(coupon: CouponQuote, userId: string, requestId: string, ip?: string) {
  await readyBilling();
  await assertUsable(coupon, userId);
  const filter: Record<string, unknown> = { _id: coupon._id, status: "active" };
  if (coupon.maxRedemptions != null) filter.redeemedCount = { $lt: coupon.maxRedemptions };
  const updated = await Coupon.findOneAndUpdate(filter, { $inc: { redeemedCount: 1 } }, { returnDocument: "after" });
  if (!updated) throw new ConflictError("Coupon is used up");
  await audit.append({
    actorId: userId,
    actorType: "user",
    action: "coupon.redeem",
    targetType: "coupon",
    targetId: String(coupon._id),
    requestId,
    ipHash: hashIp(ip),
    after: { kind: coupon.kind ?? null, percent: coupon.percent ?? null, credits: coupon.credits ?? null },
  });
  return updated;
}

export function promotionCost(price: number, coupon: CouponQuote | null) {
  if (!coupon) return price;
  if (coupon.kind === "percent") {
    return Math.max(0, price - Math.floor((price * (coupon.percent ?? 0)) / 100));
  }
  return Math.max(0, price - (coupon.credits ?? 0));
}

export function packBonus(coupon: CouponQuote, packCredits: number) {
  if (coupon.kind === "percent") return Math.floor((packCredits * (coupon.percent ?? 0)) / 100);
  return coupon.credits ?? 0;
}

export async function redeemCoupon(userId: string, code: string, requestId: string) {
  const coupon = await validateCoupon(code, userId);
  if (coupon.kind === "percent") return { couponId: String(coupon._id) };
  const updated = await consumeCoupon(coupon, userId, requestId);
  const amount = coupon.credits ?? 0;
  const result = await creditWallet({
    userId,
    amount,
    refType: "coupon",
    refId: `${coupon._id}:${updated.redeemedCount ?? 0}`,
    requestId,
    actorId: userId,
  });
  return { couponId: String(coupon._id), credit: amount, balance: result.balance };
}

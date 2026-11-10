import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ConflictError, PaymentRequiredError, ValidationError, isDuplicateKey } from "@/server/http";
import { Coupon, Payment, PromotionOrder, PromotionProduct, WalletEntry } from "@/server/models";
import { hashIp } from "@/server/shared/crypto";

const audit = new AuditRepository();
const ATTEMPTS = 8;

let indexes: Promise<void> | null = null;

export async function readyBilling() {
  await connectDb();
  if (!indexes) {
    indexes = Promise.all([
      WalletEntry.init(),
      Payment.init(),
      PromotionOrder.init(),
      PromotionProduct.init(),
      Coupon.init(),
    ]).then(() => undefined);
  }
  try {
    await indexes;
  } catch (error) {
    indexes = null;
    throw error;
  }
}

export function objectId(value: string, field: string) {
  if (!mongoose.isValidObjectId(value)) {
    throw new ValidationError("Invalid request", { [field]: ["Invalid id"] });
  }
  return new mongoose.Types.ObjectId(value);
}

export async function walletBalance(userId: string) {
  await readyBilling();
  return sumBalance(objectId(userId, "userId"));
}

async function sumBalance(userId: Types.ObjectId) {
  const rows = await WalletEntry.find({ userId }).select("delta").lean();
  return rows.reduce((sum, row) => sum + row.delta, 0);
}

function duplicateKey(error: unknown): boolean {
  if (isDuplicateKey(error)) return true;
  if (typeof error === "object" && error !== null && "cause" in error) {
    return isDuplicateKey((error as { cause: unknown }).cause);
  }
  return false;
}

interface AppendInput {
  userId: Types.ObjectId;
  delta: number;
  reason: "credit" | "debit" | "refund";
  refType: string;
  refId: string;
  requestId: string;
  actorId?: string | null;
  actorType: "user" | "admin" | "worker" | "system";
  auditAction: string;
  auditReason?: string;
  ip?: string;
}

/**
 * Inserts one ledger row. The chain key is unique per previous tip, so two
 * debits that read the same balance cannot both commit.
 */
async function appendEntry(input: AppendInput) {
  await readyBilling();
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const existing = await WalletEntry.findOne({
      userId: input.userId,
      refType: input.refType,
      refId: input.refId,
    }).lean();
    if (existing) return { balance: await sumBalance(input.userId), created: false };

    const rows = (await WalletEntry.find({ userId: input.userId }).sort({ _id: 1 }).select("delta").lean()) as Array<{
      _id: Types.ObjectId;
      delta: number;
    }>;
    const balance = rows.reduce((sum, row) => sum + row.delta, 0);
    if (input.delta < 0 && balance + input.delta < 0) {
      throw new PaymentRequiredError("Insufficient credits");
    }
    const tip = rows[rows.length - 1];
    const parent = tip ? String(tip._id) : "0";
    try {
      await WalletEntry.create({
        userId: input.userId,
        delta: input.delta,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        balanceAfter: balance + input.delta,
        idempotencyKey: `chain:${input.userId.toString()}:${parent}`,
      });
      const next = balance + input.delta;
      await audit.append({
        actorId: input.actorId ?? null,
        actorType: input.actorType,
        action: input.auditAction,
        targetType: "wallet",
        targetId: input.userId.toString(),
        requestId: input.requestId,
        reason: input.auditReason,
        ipHash: hashIp(input.ip),
        after: {
          delta: input.delta,
          balanceAfter: next,
          reason: input.reason,
          refType: input.refType,
          refId: input.refId,
        },
      });
      return { balance: next, created: true };
    } catch (error) {
      if (!duplicateKey(error)) throw error;
    }
  }
  throw new ConflictError("Wallet is busy");
}

export async function creditWallet(input: {
  userId: string;
  amount: number;
  refType: string;
  refId: string;
  requestId: string;
  actorId?: string;
  actorType?: AppendInput["actorType"];
  reason?: "credit" | "refund";
  auditAction?: string;
  auditReason?: string;
  ip?: string;
}) {
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw new ValidationError("Invalid request", { amount: ["Invalid amount"] });
  }
  return appendEntry({
    userId: objectId(input.userId, "userId"),
    delta: input.amount,
    reason: input.reason ?? "credit",
    refType: input.refType,
    refId: input.refId,
    requestId: input.requestId,
    actorId: input.actorId ?? input.userId,
    actorType: input.actorType ?? "user",
    auditAction: input.auditAction ?? "wallet.credit",
    auditReason: input.auditReason,
    ip: input.ip,
  });
}

export async function debitWallet(input: {
  userId: string;
  amount: number;
  refType: string;
  refId: string;
  requestId: string;
  actorId?: string;
  ip?: string;
}) {
  if (!Number.isInteger(input.amount) || input.amount < 0) {
    throw new ValidationError("Invalid request", { amount: ["Invalid amount"] });
  }
  return appendEntry({
    userId: objectId(input.userId, "userId"),
    delta: -input.amount,
    reason: "debit",
    refType: input.refType,
    refId: input.refId,
    requestId: input.requestId,
    actorId: input.actorId ?? input.userId,
    actorType: "user",
    auditAction: "wallet.debit",
    ip: input.ip,
  });
}

export async function listEntries(userId: string, page: number, pageSize: number) {
  await readyBilling();
  const id = objectId(userId, "userId");
  const filter = { userId: id };
  const [rows, total] = await Promise.all([
    WalletEntry.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    WalletEntry.countDocuments(filter),
  ]);
  return {
    items: rows.map((row) => ({
      id: String(row._id),
      delta: row.delta,
      reason: row.reason,
      refType: row.refType,
      refId: row.refId,
      balanceAfter: row.balanceAfter,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    })),
    total,
  };
}

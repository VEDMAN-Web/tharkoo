import { Schema, Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { objectId } from "@/server/billing/ledger";
import { ConflictError, NotFoundError, PaymentRequiredError, ValidationError, VerificationRequiredError } from "@/server/http";
import { accountBalance, postTransaction, type PostInput } from "@/server/ledger";
import { registerModel } from "@/server/models/register";
import { getPayoutKyc, maskedKyc, PayoutKyc, type MaskedPayoutKyc } from "@/server/wallet/payout-kyc";
import { payoutProvider, type InitiatePayoutResult } from "@/server/wallet/payout-provider";
import { assertFinanceStaff, getFinanceSettings } from "@/server/wallet/settings";
import { hashIp } from "@/server/shared/crypto";

const audit = new AuditRepository();
const DAY_MS = 86_400_000;

export const WITHDRAWAL_STATUSES = ["requested", "approved", "paid", "failed", "rejected"] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export interface WithdrawalDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  coins: number;
  coinValueInr: number;
  /** Rupees before TDS and GST. Shown on the record only: no tax logic. */
  amountInr: number;
  tdsPercent: number;
  gstPercent: number;
  method: "bank" | "upi";
  status: WithdrawalStatus;
  providerRef?: string;
  reference?: string;
  reason?: string;
  decidedBy?: string;
  decidedAt?: Date;
  requestedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const withdrawalSchema = new Schema<WithdrawalDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    coins: { type: Number, required: true },
    coinValueInr: { type: Number, required: true },
    amountInr: { type: Number, required: true },
    tdsPercent: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 0 },
    method: { type: String, enum: ["bank", "upi"], required: true },
    status: { type: String, enum: WITHDRAWAL_STATUSES, required: true, default: "requested" },
    providerRef: String,
    reference: String,
    reason: String,
    decidedBy: String,
    decidedAt: Date,
    requestedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true, collection: "withdrawal_requests" },
);
withdrawalSchema.index({ userId: 1, requestedAt: -1 });
withdrawalSchema.index({ status: 1, requestedAt: -1 });

export const Withdrawal = registerModel<WithdrawalDoc>("Withdrawal", withdrawalSchema);

type WithdrawalRow = WithdrawalDoc & { _id: Types.ObjectId };

interface StaffInput {
  id: string;
  actorId: string;
  roles: readonly string[];
  requestId: string;
  ip?: string;
}

function present(row: WithdrawalDoc & { _id?: unknown }) {
  return {
    id: String(row._id),
    status: row.status,
    method: row.method,
    coins: row.coins,
    coinValueInr: row.coinValueInr,
    amountInr: row.amountInr,
    tdsPercent: row.tdsPercent,
    gstPercent: row.gstPercent,
    reference: row.reference ?? null,
    reason: row.reason ?? null,
    requestedAt: new Date(row.requestedAt).toISOString(),
    decidedAt: row.decidedAt ? new Date(row.decidedAt).toISOString() : null,
  };
}

function formatWait(seconds: number) {
  if (seconds >= DAY_MS / 1000) {
    const days = Math.ceil(seconds / (DAY_MS / 1000));
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  const hours = Math.max(1, Math.ceil(seconds / 3600));
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** Moves coins from earnings into payout_pending. Refused unless the vendor has payout details, the minimum is met, funds exist and the cooldown has passed. */
export async function requestWithdrawal(input: { userId: string; coins: number; requestId: string; ip?: string }) {
  await connectDb();
  await Withdrawal.init();
  const userId = objectId(input.userId, "userId");
  const [kyc, settings] = await Promise.all([PayoutKyc.findOne({ userId }).select("method").lean(), getFinanceSettings()]);
  if (!kyc) throw new VerificationRequiredError("Add your payout details before you withdraw");
  if (!Number.isInteger(input.coins) || input.coins < settings.minWithdrawCoins) {
    throw new ValidationError("Invalid request", { coins: [`The minimum withdrawal is ${settings.minWithdrawCoins} coins`] });
  }
  if ((await accountBalance("vendor_earnings", input.userId)) < input.coins) {
    throw new PaymentRequiredError("Not enough earnings for that withdrawal");
  }
  // One atomic counter per vendor: the first request in a window takes it, so parallel requests cannot both pass.
  if (settings.withdrawCooldownDays > 0) {
    const gate = await consumeRateLimit(`withdraw-cooldown:${input.userId}`, 1, settings.withdrawCooldownDays * DAY_MS);
    if (!gate.ok) throw new ConflictError(`You can request another withdrawal in ${formatWait(gate.retryAfter)}`);
  }
  const row = await Withdrawal.create({
    userId,
    coins: input.coins,
    coinValueInr: settings.coinValueInr,
    amountInr: input.coins * settings.coinValueInr,
    tdsPercent: settings.tdsPercent,
    gstPercent: settings.gstPercent,
    method: kyc.method,
    status: "requested",
    requestedAt: new Date(),
  });
  try {
    await postTransaction({
      idempotencyKey: `withdraw-hold:${row._id}`,
      kind: "withdrawal_hold",
      refType: "withdrawal",
      refId: String(row._id),
      moves: [
        { account: "vendor_earnings", ownerKey: input.userId, delta: -input.coins },
        { account: "payout_pending", ownerKey: input.userId, delta: input.coins },
      ],
      requestId: input.requestId,
      actorId: input.userId,
      actorType: "user",
      ip: input.ip,
    });
  } catch (error) {
    await Withdrawal.deleteOne({ _id: row._id });
    throw error;
  }
  await audit.append({
    actorId: input.userId,
    actorType: "user",
    action: "payout.request",
    targetType: "withdrawal",
    targetId: String(row._id),
    requestId: input.requestId,
    after: { coins: input.coins, amountInr: row.amountInr },
    ipHash: hashIp(input.ip),
  });
  return present(row.toObject());
}

/** Returns the coins from payout_pending to the vendor's earnings. Keyed on the withdrawal, so a repeat changes nothing. */
function returnCoins(row: WithdrawalRow, input: { requestId: string; actorId?: string; actorType: "user" | "admin" | "system"; reason: string; ip?: string }) {
  const owner = String(row.userId);
  const post: PostInput = {
    idempotencyKey: `withdraw-return:${row._id}`,
    kind: "withdrawal_return",
    refType: "withdrawal",
    refId: String(row._id),
    moves: [
      { account: "payout_pending", ownerKey: owner, delta: -row.coins },
      { account: "vendor_earnings", ownerKey: owner, delta: row.coins },
    ],
    requestId: input.requestId,
    actorId: input.actorId ?? null,
    actorType: input.actorType,
    reason: input.reason,
    ip: input.ip,
  };
  return postTransaction(post);
}

/**
 * Moves a payout from `from` to `to` before its money work runs. Only one caller wins the claim, so a double click
 * cannot pay twice. If the money work fails, the status goes back.
 */
async function claim(id: string, from: WithdrawalStatus, to: WithdrawalStatus, patch: Partial<WithdrawalDoc>) {
  const objectIdValue = objectId(id, "id");
  const exists = await Withdrawal.exists({ _id: objectIdValue });
  if (!exists) throw new NotFoundError("Not found");
  const before = await Withdrawal.findOneAndUpdate({ _id: objectIdValue, status: from }, { $set: { ...patch, status: to } }, { returnDocument: "before" }).lean();
  if (!before) throw new ConflictError("This payout is not in the right state for that action");
  return before as WithdrawalRow;
}

async function release(id: string, from: WithdrawalStatus, to: WithdrawalStatus) {
  await Withdrawal.updateOne(
    { _id: objectId(id, "id"), status: to },
    { $set: { status: from }, $unset: { decidedAt: "", decidedBy: "", reason: "", reference: "" } },
  );
}

async function auditPayout(action: string, row: WithdrawalRow, input: StaffInput, before: string, after: string, extra: Record<string, unknown> = {}) {
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action,
    targetType: "withdrawal",
    targetId: String(row._id),
    requestId: input.requestId,
    reason: typeof extra.reason === "string" ? extra.reason : undefined,
    ipHash: hashIp(input.ip),
    before: { status: before },
    after: { status: after, coins: row.coins, ...extra },
  });
}

/** Approves a requested payout and sends it through the PayoutProvider. A provider refusal returns the coins. */
export async function approveWithdrawal(input: StaffInput) {
  assertFinanceStaff(input.roles);
  await connectDb();
  const row = await claim(input.id, "requested", "approved", { decidedAt: new Date(), decidedBy: input.actorId });
  const base = { requestId: input.requestId, actorId: input.actorId, actorType: "admin" as const, ip: input.ip };
  let result: InitiatePayoutResult;
  try {
    result = await payoutProvider().initiate({ withdrawalId: String(row._id), amountInr: row.amountInr, method: row.method });
  } catch (error) {
    // Nothing was sent, so the payout can be approved again later.
    await release(input.id, "requested", "approved");
    throw error;
  }
  if (!result.ok) {
    await returnCoins(row, { ...base, reason: result.reason });
    await Withdrawal.updateOne({ _id: row._id, status: "approved" }, { $set: { status: "failed", reason: result.reason } });
    await auditPayout("payout.fail", row, input, "approved", "failed", { reason: result.reason });
    return { status: "failed" as const };
  }
  await Withdrawal.updateOne({ _id: row._id }, { $set: { providerRef: result.providerRef } });
  await auditPayout("payout.approve", row, input, "requested", "approved", { providerRef: result.providerRef });
  return { status: "approved" as const };
}

/** Rejects a requested payout and returns the coins to earnings. */
export async function rejectWithdrawal(input: StaffInput & { reason: string }) {
  assertFinanceStaff(input.roles);
  await connectDb();
  const row = await claim(input.id, "requested", "rejected", { decidedAt: new Date(), decidedBy: input.actorId, reason: input.reason });
  try {
    await returnCoins(row, { requestId: input.requestId, actorId: input.actorId, actorType: "admin", reason: input.reason, ip: input.ip });
  } catch (error) {
    await release(input.id, "requested", "rejected");
    throw error;
  }
  await auditPayout("payout.reject", row, input, "requested", "rejected", { reason: input.reason });
  return { status: "rejected" as const };
}

/** Marks an approved payout as paid, with the bank or UPI reference Finance recorded. The coins leave the platform. */
export async function markWithdrawalPaid(input: StaffInput & { reference: string }) {
  assertFinanceStaff(input.roles);
  await connectDb();
  const row = await claim(input.id, "approved", "paid", { decidedAt: new Date(), decidedBy: input.actorId, reference: input.reference });
  const owner = String(row.userId);
  try {
    await postTransaction({
      idempotencyKey: `withdraw-paid:${row._id}`,
      kind: "withdrawal_paid",
      refType: "withdrawal",
      refId: String(row._id),
      moves: [
        { account: "payout_pending", ownerKey: owner, delta: -row.coins },
        { account: "paid_out", ownerKey: owner, delta: row.coins },
      ],
      requestId: input.requestId,
      actorId: input.actorId,
      actorType: "admin",
      ip: input.ip,
    });
  } catch (error) {
    await release(input.id, "approved", "paid");
    throw error;
  }
  await auditPayout("payout.paid", row, input, "approved", "paid", { reference: input.reference });
  return { status: "paid" as const };
}

/** An approved payout that did not reach the bank. The coins go back to earnings. */
export async function markWithdrawalFailed(input: StaffInput & { reason: string }) {
  assertFinanceStaff(input.roles);
  await connectDb();
  const row = await claim(input.id, "approved", "failed", { decidedAt: new Date(), decidedBy: input.actorId, reason: input.reason });
  try {
    await returnCoins(row, { requestId: input.requestId, actorId: input.actorId, actorType: "admin", reason: input.reason, ip: input.ip });
  } catch (error) {
    await release(input.id, "approved", "failed");
    throw error;
  }
  await auditPayout("payout.fail", row, input, "approved", "failed", { reason: input.reason });
  return { status: "failed" as const };
}

export async function listOwnWithdrawals(userId: string, page: number, pageSize: number) {
  await connectDb();
  await Withdrawal.init();
  const filter = { userId: objectId(userId, "userId") };
  const [rows, total] = await Promise.all([
    Withdrawal.find(filter)
      .sort({ requestedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Withdrawal.countDocuments(filter),
  ]);
  return { items: rows.map(present), total };
}

export interface StaffPayoutRow extends ReturnType<typeof present> {
  userId: string;
  payout: MaskedPayoutKyc | null;
}

/** The Finance queue. Bank and UPI details are masked here too. */
export async function listPayoutsForStaff(input: { roles: readonly string[]; status?: WithdrawalStatus; limit?: number }): Promise<StaffPayoutRow[]> {
  assertFinanceStaff(input.roles);
  await connectDb();
  await Withdrawal.init();
  const filter = input.status ? { status: input.status } : {};
  const rows = await Withdrawal.find(filter)
    .sort({ requestedAt: -1, _id: -1 })
    .limit(Math.min(input.limit ?? 200, 500))
    .lean();
  const kycRows = await PayoutKyc.find({ userId: { $in: [...new Set(rows.map((row) => String(row.userId)))].map((id) => new Types.ObjectId(id)) } }).lean();
  const kycByUser = new Map(kycRows.map((row) => [String(row.userId), maskedKyc(row)]));
  return rows.map((row) => ({ ...present(row), userId: String(row.userId), payout: kycByUser.get(String(row.userId)) ?? null }));
}

/** Everything the vendor's wallet screen needs in one call. Pending means payout_pending. */
export async function payoutSummary(userId: string) {
  await connectDb();
  await Withdrawal.init();
  const [available, pending, paid, kyc, settings, last] = await Promise.all([
    accountBalance("vendor_earnings", userId),
    accountBalance("payout_pending", userId),
    accountBalance("paid_out", userId),
    getPayoutKyc(userId),
    getFinanceSettings(),
    Withdrawal.findOne({ userId: objectId(userId, "userId") }).sort({ requestedAt: -1 }).select("requestedAt").lean(),
  ]);
  const next = last && settings.withdrawCooldownDays > 0 ? new Date(new Date(last.requestedAt).getTime() + settings.withdrawCooldownDays * DAY_MS) : null;
  return {
    availableCoins: available,
    pendingCoins: pending,
    paidCoins: paid,
    coinValueInr: settings.coinValueInr,
    tdsPercent: settings.tdsPercent,
    gstPercent: settings.gstPercent,
    minWithdrawCoins: settings.minWithdrawCoins,
    withdrawCooldownDays: settings.withdrawCooldownDays,
    nextWithdrawalAt: next && next.getTime() > Date.now() ? next.toISOString() : null,
    kyc,
  };
}

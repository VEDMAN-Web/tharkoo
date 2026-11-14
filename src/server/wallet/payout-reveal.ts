import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { objectId } from "@/server/billing/ledger";
import { NotFoundError, RateLimitedError } from "@/server/http";
import { hashIp } from "@/server/shared/crypto";
import { PayoutKyc, revealedKyc, type RevealedPayoutKyc } from "@/server/wallet/payout-kyc";
import { assertFinanceStaff } from "@/server/wallet/settings";
import { Withdrawal, type StaffInput } from "@/server/wallet/withdrawals";

const audit = new AuditRepository();
const HOUR_MS = 3_600_000;

/** Full payout details are revealed at most this many times per hour for each staff member. */
export const REVEAL_LIMIT_PER_HOUR = 20;

export function revealRateKey(actorId: string) {
  return `payout-reveal:${actorId}`;
}

export interface RevealedWithdrawal {
  withdrawalId: string;
  revealedAt: string;
  details: RevealedPayoutKyc;
}

/**
 * Decrypts the payout details behind ONE withdrawal for finance staff. Each reveal is audited (who, when, which
 * withdrawal) without the values, and is rate-limited per staff member. The response is sent with no-store by the route.
 */
export async function revealWithdrawalDetails(input: StaffInput): Promise<RevealedWithdrawal> {
  assertFinanceStaff(input.roles);
  await connectDb();
  const gate = await consumeRateLimit(revealRateKey(input.actorId), REVEAL_LIMIT_PER_HOUR, HOUR_MS);
  if (!gate.ok) {
    throw new RateLimitedError(`Too many reveals. Try again in ${Math.ceil(gate.retryAfter / 60)} minutes`);
  }
  const withdrawalId = objectId(input.id, "id");
  const withdrawal = await Withdrawal.findById(withdrawalId).select("userId").lean();
  if (!withdrawal) throw new NotFoundError("Not found");
  const kyc = await PayoutKyc.findOne({ userId: withdrawal.userId }).lean();
  if (!kyc) throw new NotFoundError("No payout details on file for this withdrawal");
  const details = revealedKyc(kyc);
  const revealedAt = new Date();
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "payout.reveal",
    targetType: "withdrawal",
    targetId: String(withdrawalId),
    requestId: input.requestId,
    ipHash: hashIp(input.ip),
  });
  return { withdrawalId: String(withdrawalId), revealedAt: revealedAt.toISOString(), details };
}

import { connectDb } from "@/lib/db";
import { insufficientCreditsLine } from "@/lib/ui/publish-errors";
import { PaymentRequiredError } from "@/server/http";
import { creditWallet, debitWallet, readyBilling, walletBalance } from "@/server/billing/ledger";
import { effectivePostingFee, readMoneySettings } from "@/server/billing/money-settings";
import { WalletEntry } from "@/server/models";

export const FEE_REF = "listing_fee";
export const FEE_REFUND_REF = "listing_fee_refund";

export class InsufficientCreditsError extends Error {
  readonly need: number;
  readonly balance: number;
  readonly fee: number;
  readonly short: number;

  constructor(fee: number, balance: number) {
    super("INSUFFICIENT_CREDITS");
    this.name = "InsufficientCreditsError";
    this.fee = fee;
    this.need = fee;
    this.balance = balance;
    this.short = Math.max(0, fee - balance);
  }
}

export function insufficientCreditsMessage(short: number): string {
  return insufficientCreditsLine(short);
}

export async function postingFeeStatus(userId: string) {
  await connectDb();
  const [money, balance] = await Promise.all([readMoneySettings(), walletBalance(userId)]);
  const fee = effectivePostingFee(money);
  const short = Math.max(0, fee - balance);
  return {
    fee,
    balance,
    after: Math.max(0, balance - fee),
    short,
    enough: short === 0,
    creditPriceInr: money.creditPriceInr,
    mockPaymentsOn: money.mockPaymentsOn,
  };
}

async function feeRows(listingId: string) {
  await readyBilling();
  const prefix = new RegExp(`^${listingId}:`);
  const [debits, refunds] = await Promise.all([
    WalletEntry.countDocuments({ refType: FEE_REF, refId: prefix }),
    WalletEntry.countDocuments({ refType: FEE_REFUND_REF, refId: prefix }),
  ]);
  return { debits, refunds };
}

export async function isPostingFeePaid(listingId: string): Promise<boolean> {
  await connectDb();
  const { debits, refunds } = await feeRows(listingId);
  return debits > refunds;
}

export type PostingCharge = { charged: number; balance: number; refId: string | null };

export async function chargePostingFee(input: { userId: string; listingId: string; requestId: string }): Promise<PostingCharge> {
  await connectDb();
  const fee = effectivePostingFee(await readMoneySettings());
  const { debits, refunds } = await feeRows(input.listingId);
  if (fee <= 0 || debits > refunds) return { charged: 0, balance: await walletBalance(input.userId), refId: null };
  const balance = await walletBalance(input.userId);
  if (balance < fee) throw new InsufficientCreditsError(fee, balance);
  const refId = `${input.listingId}:${debits}`;
  try {
    const result = await debitWallet({ userId: input.userId, amount: fee, refType: FEE_REF, refId, requestId: input.requestId, once: true });
    return { charged: result.created ? fee : 0, balance: result.balance, refId: result.created ? refId : null };
  } catch (error) {
    if (error instanceof PaymentRequiredError) throw new InsufficientCreditsError(fee, await walletBalance(input.userId));
    throw error;
  }
}

export async function refundPostingFee(input: { userId: string; listingId: string; requestId: string }): Promise<number> {
  await connectDb();
  const { debits, refunds } = await feeRows(input.listingId);
  if (debits <= refunds) return 0;
  const debit = await WalletEntry.findOne({ refType: FEE_REF, refId: `${input.listingId}:${refunds}` }).select("delta").lean<{ delta: number } | null>();
  const amount = debit ? Math.abs(debit.delta) : 0;
  if (amount < 1) return 0;
  const result = await creditWallet({
    userId: input.userId,
    amount,
    refType: FEE_REFUND_REF,
    refId: `${input.listingId}:${refunds}`,
    requestId: input.requestId,
    actorType: "system",
    reason: "refund",
    auditAction: "wallet.posting_fee.refund",
    once: true,
  });
  return result.created ? amount : 0;
}

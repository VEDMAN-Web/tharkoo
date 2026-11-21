import { InternalError } from "@/server/http";
import { passimpayWithdraw } from "@/server/billing/passimpay";
import { randomToken } from "@/server/shared/crypto";

export type PayoutProviderName = "mock" | "bank" | "passimpay";

export interface InitiatePayoutInput {
  withdrawalId: string;
  /** Rupees. */
  amountInr: number;
  method: "bank" | "upi" | "crypto";
  /** H18.6: set for crypto payouts. */
  crypto?: { network: "TRC20" | "BEP20"; address: string };
  /** H18.6: the exact USDT the admin chose to send. Without it the rupees are converted at USDT_INR_RATE. */
  usdtAmount?: string;
}

export type InitiatePayoutResult = { ok: true; providerRef: string } | { ok: false; reason: string };

/**
 * Sends money out. Approving a payout calls this once. A thrown error means nothing was sent and the payout stays requested.
 * A returned { ok: false } means the provider refused: the coins go back to the vendor.
 */
export interface PayoutProvider {
  readonly name: PayoutProviderName;
  initiate(input: InitiatePayoutInput): Promise<InitiatePayoutResult>;
}

/** Pretend payouts for development and tests. It never moves money, so it is refused in production. */
const mockPayouts: PayoutProvider = {
  name: "mock",
  initiate: async () => {
    if (process.env.NODE_ENV === "production") {
      throw new InternalError("PAYOUT_PROVIDER=mock is not allowed in production");
    }
    return { ok: true, providerRef: `mock_payout_${randomToken().slice(0, 20)}` };
  },
};

/** TODO: bank transfer API using PAYOUT_API_KEY_ID and PAYOUT_API_KEY_SECRET. Not built: no account exists yet. */
const bankPayouts: PayoutProvider = {
  name: "bank",
  initiate: async () => {
    throw new InternalError("Bank payouts are not configured (needs PAYOUT_API_KEY_ID and PAYOUT_API_KEY_SECRET)");
  },
};

export function payoutProviderName(): PayoutProviderName {
  return (process.env.PAYOUT_PROVIDER || "mock").trim() === "bank" ? "bank" : "mock";
}

let override: PayoutProvider | null = null;

/** Tests swap in a provider that refuses or fails here. Pass null to restore the environment choice. */
export function setPayoutProvider(provider: PayoutProvider | null) {
  override = provider;
}

/** H18.6: PassimPay USDT payout ids (from /v2/currencies): USDT TRC20 = 71, USDT BEP20 = 72. */
const PASSIMPAY_USDT_IDS = { TRC20: 71, BEP20: 72 } as const;

/** Rupees per 1 USDT used to size a crypto payout. Server setting USDT_INR_RATE; 88 when unset. */
export function usdtInrRate(): number {
  const rate = Number(process.env.USDT_INR_RATE);
  return Number.isFinite(rate) && rate > 0 ? rate : 88;
}

/** INR -> USDT, rounded down to cents so the platform never sends more than the rupee value. */
export function usdtForInr(amountInr: number, rate = usdtInrRate()): string {
  return (Math.floor((amountInr / rate) * 100) / 100).toFixed(2);
}

/** H18.6: sends USDT through PassimPay. A refusal returns { ok: false } (the coins go back); a network error throws (stays requested). */
const passimpayPayouts: PayoutProvider = {
  name: "passimpay",
  initiate: async (input) => {
    if (!input.crypto) return { ok: false, reason: "No crypto wallet on file" };
    if (input.usdtAmount !== undefined && !/^\d{1,9}(\.\d{1,6})?$/.test(input.usdtAmount)) return { ok: false, reason: "Enter the USDT amount as a number, e.g. 11.50" };
    const amount = input.usdtAmount ?? usdtForInr(input.amountInr);
    if (Number(amount) < 1) return { ok: false, reason: "Amount is below 1 USDT" };
    const result = await passimpayWithdraw({ paymentId: PASSIMPAY_USDT_IDS[input.crypto.network], orderId: input.withdrawalId, addressTo: input.crypto.address, amount });
    return result.ok ? { ok: true, providerRef: result.transactionId } : { ok: false, reason: result.reason };
  },
};

/** The provider for one payout: crypto always goes through PassimPay; bank and UPI use PAYOUT_PROVIDER. */
export function payoutProviderFor(method: "bank" | "upi" | "crypto"): PayoutProvider {
  if (override) return override;
  return method === "crypto" ? passimpayPayouts : payoutProvider();
}

export function payoutProvider(): PayoutProvider {
  if (override) return override;
  return payoutProviderName() === "bank" ? bankPayouts : mockPayouts;
}

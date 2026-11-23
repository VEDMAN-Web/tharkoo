import { InternalError, ValidationError } from "@/server/http";
import { passimpayWithdraw } from "@/server/billing/passimpay";
import { randomToken } from "@/server/shared/crypto";
import { findPayoutOption, resolvePaymentId, usdtInrRate, type PayoutCoin, type PayoutNetwork } from "@/server/wallet/payout-coins";

export { usdtInrRate };

export type PayoutProviderName = "mock" | "bank" | "passimpay";

export interface InitiatePayoutInput {
  withdrawalId: string;
  /** Rupees. */
  amountInr: number;
  method: "bank" | "upi" | "crypto";
  /** H18.6: set for crypto payouts. H19.9: coin is USDT when missing (older saved wallets). */
  crypto?: { network: PayoutNetwork; coin?: PayoutCoin; address: string };
  /** H18.6: the exact amount the admin chose to send, in the vendor's coin. For USDT and USDC, without it the rupees are converted at USDT_INR_RATE. */
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

/** INR -> USDT, rounded down to cents so the platform never sends more than the rupee value. */
export function usdtForInr(amountInr: number, rate = usdtInrRate()): string {
  return (Math.floor((amountInr / rate) * 100) / 100).toFixed(2);
}

/** H18.6: sends USDT through PassimPay. H19.9: any coin in payout-coins.ts; its PassimPay id comes from /v2/currencies. A refusal returns { ok: false } (the coins go back); a network error throws (stays requested). */
const passimpayPayouts: PayoutProvider = {
  name: "passimpay",
  initiate: async (input) => {
    if (!input.crypto) return { ok: false, reason: "No crypto wallet on file" };
    const coin = input.crypto.coin ?? "USDT";
    const option = findPayoutOption(coin, input.crypto.network);
    // A thrown error leaves the payout requested (nothing was sent), so the admin can fix the amount and try again.
    if (!option) throw new ValidationError("That coin is not available for payouts", { usdtAmount: ["That coin is not available for payouts"] });
    if (input.usdtAmount !== undefined && !/^\d{1,9}(\.\d{1,8})?$/.test(input.usdtAmount)) throw new ValidationError("Invalid amount", { usdtAmount: [`Enter the ${coin} amount as a number, e.g. 11.50`] });
    const dollarCoin = coin === "USDT" || coin === "USDC";
    // Only a dollar coin can be sized from rupees alone; any other coin needs the amount the admin chose from the live estimate.
    if (input.usdtAmount === undefined && !dollarCoin) throw new ValidationError("Enter the amount to send", { usdtAmount: [`Enter how much ${coin} to send`] });
    const amount = input.usdtAmount ?? usdtForInr(input.amountInr);
    if (!(Number(amount) >= option.min)) throw new ValidationError("Amount is too small", { usdtAmount: [`Amount is below ${option.min} ${coin}`] });
    const result = await passimpayWithdraw({ paymentId: await resolvePaymentId(coin, input.crypto.network), orderId: input.withdrawalId, addressTo: input.crypto.address, amount });
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

import { InternalError } from "@/server/http";
import { randomToken } from "@/server/shared/crypto";

export type PayoutProviderName = "mock" | "bank";

export interface InitiatePayoutInput {
  withdrawalId: string;
  /** Rupees. */
  amountInr: number;
  method: "bank" | "upi";
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

export function payoutProvider(): PayoutProvider {
  if (override) return override;
  return payoutProviderName() === "bank" ? bankPayouts : mockPayouts;
}

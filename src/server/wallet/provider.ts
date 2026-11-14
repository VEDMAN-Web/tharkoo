import { z } from "zod";
import { InternalError } from "@/server/http";
import { randomToken } from "@/server/shared/crypto";

export type CoinProviderName = "mock" | "cryptoPay" | "card";

export interface CreatePaymentInput {
  purchaseId: string;
  /** Rupees. */
  amount: number;
  currency: string;
}

export interface CreatedPayment {
  providerPaymentId: string;
  /** Where the browser goes to pay. It is never proof of payment: coins are credited by the webhook only. */
  checkoutUrl: string | null;
}

export const providerEventSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  providerPaymentId: z.string().trim().min(1).max(200),
  status: z.enum(["succeeded", "failed", "refunded"]),
  amount: z.number().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
});
export type ProviderEvent = z.infer<typeof providerEventSchema>;

/** One implementation per way of paying. Nothing here touches the wallet. */
export interface PaymentProvider {
  readonly name: CoinProviderName;
  createPayment(input: CreatePaymentInput): CreatedPayment;
}

const mockProvider: PaymentProvider = {
  name: "mock",
  createPayment: () => ({ providerPaymentId: `mock_${randomToken().slice(0, 24)}`, checkoutUrl: null }),
};

/** TODO: call Crypto Pay with CRYPTO_PAY_API_TOKEN and verify its webhook. Not built: no key exists yet. */
const cryptoPayProvider: PaymentProvider = {
  name: "cryptoPay",
  createPayment: () => {
    throw new InternalError("Crypto Pay is not configured (needs CRYPTO_PAY_API_TOKEN)");
  },
};

/** TODO: card gateway using CARD_PAYMENT_KEY_ID and CARD_PAYMENT_KEY_SECRET. Not built: ask Vedant which gateway. */
const cardProvider: PaymentProvider = {
  name: "card",
  createPayment: () => {
    throw new InternalError("Card payments are not configured (needs CARD_PAYMENT_KEY_ID and CARD_PAYMENT_KEY_SECRET)");
  },
};

export function coinProviderName(): CoinProviderName {
  const value = (process.env.COIN_PAYMENT_PROVIDER || "mock").trim();
  return value === "cryptoPay" || value === "card" ? value : "mock";
}

export function coinProvider(): PaymentProvider {
  const name = coinProviderName();
  if (name === "cryptoPay") return cryptoPayProvider;
  if (name === "card") return cardProvider;
  return mockProvider;
}

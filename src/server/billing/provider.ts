import { InternalError, PolicyViolationError } from "@/server/http";
import { hmacSha256, randomToken, safeEqual } from "@/server/shared/crypto";

export interface ProviderOrder {
  provider: "mock" | "razorpay";
  providerRef: string;
  request: {
    amount: number;
    currency: string;
    receipt: string;
    payment_capture?: number;
  };
}

export function paymentProvider(): "mock" | "razorpay" {
  return (process.env.PAYMENT_PROVIDER || "mock").trim().toLowerCase() === "razorpay" ? "razorpay" : "mock";
}

export function livePaymentsAllowed() {
  return (process.env.ALLOW_LIVE_PAYMENTS || "").trim().toLowerCase() === "true";
}

export function isLiveKey(keyId: string) {
  return keyId.startsWith(`${["rzp", "live"].join("_")}_`);
}

/** Builds a provider order. The Razorpay branch never opens a socket. */
export function createCheckoutOrder(input: { amount: number; currency: string; receipt: string }): ProviderOrder {
  if (paymentProvider() !== "razorpay") {
    return {
      provider: "mock",
      providerRef: `pay_test_${randomToken().slice(0, 16)}`,
      request: { amount: input.amount, currency: input.currency, receipt: input.receipt },
    };
  }
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!keyId || !keySecret) throw new InternalError("Payment provider is not configured");
  if (isLiveKey(keyId) && !livePaymentsAllowed()) {
    throw new PolicyViolationError("Live payments are disabled");
  }
  return {
    provider: "razorpay",
    providerRef: `shape_${input.receipt}`,
    request: {
      amount: Math.round(input.amount * 100),
      currency: input.currency,
      receipt: input.receipt,
      payment_capture: 1,
    },
  };
}

/** A webhook whose timestamp is further than this (seconds) from now is refused, so a captured request cannot be replayed later. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type WebhookRefusal = "missing" | "stale" | "bad-signature";

/** What the provider signs: the timestamp and the raw body together, so neither can be changed alone. */
export function webhookSignature(secret: string, timestamp: number, raw: string) {
  return hmacSha256(secret, `${timestamp}.${raw}`);
}

/** Returns why a webhook must be refused, or null when its signature and timestamp are valid. */
export function webhookRejection(request: Request, raw: string, nowMs = Date.now()): WebhookRefusal | null {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() ?? "";
  const given = request.headers.get("x-payment-signature")?.trim() ?? "";
  const stamp = request.headers.get("x-payment-timestamp")?.trim() ?? "";
  if (!secret || !given || !/^\d{1,12}$/.test(stamp)) return "missing";
  const timestamp = Number(stamp);
  if (Math.abs(nowMs / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return "stale";
  return safeEqual(given, webhookSignature(secret, timestamp, raw)) ? null : "bad-signature";
}

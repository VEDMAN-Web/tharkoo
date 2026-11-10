import { InternalError, PolicyViolationError, UnauthorizedError } from "@/server/http";
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

export function assertWebhookSignature(request: Request, raw: string) {
  const expected = process.env.PAYMENT_WEBHOOK_SECRET?.trim() ?? "";
  const given =
    request.headers.get("x-payment-signature") || request.headers.get("x-razorpay-signature") || "";
  if (!expected || !given || !safeEqual(given, hmacSha256(expected, raw))) {
    throw new UnauthorizedError("Unauthorized");
  }
}

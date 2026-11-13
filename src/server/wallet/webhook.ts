import { hmacSha256, safeEqual } from "@/server/shared/crypto";

/** A webhook further than this many seconds from now is refused, so a captured request cannot be replayed later. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type WebhookRefusal = "missing" | "stale" | "bad-signature";

/** What the provider signs: the timestamp and the raw body together. */
export function signWebhook(secret: string, timestamp: number, raw: string) {
  return hmacSha256(secret, `${timestamp}.${raw}`);
}

/** Why a webhook must be refused, or null when the signature (constant-time compare) and timestamp are valid. */
export function verifyWebhook(headers: Headers, raw: string, nowMs = Date.now()): WebhookRefusal | null {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() ?? "";
  const given = headers.get("x-payment-signature")?.trim() ?? "";
  const stamp = headers.get("x-payment-timestamp")?.trim() ?? "";
  if (!secret || !given || !/^\d{1,12}$/.test(stamp)) return "missing";
  const timestamp = Number(stamp);
  if (Math.abs(nowMs / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return "stale";
  return safeEqual(given, signWebhook(secret, timestamp, raw)) ? null : "bad-signature";
}

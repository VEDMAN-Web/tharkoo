import { InternalError } from "@/server/http";
import { hmacSha256, safeEqual } from "@/server/shared/crypto";

/**
 * H18.1: PassimPay crypto checkout. Plain fetch and node:crypto, no package.
 * The API key and every signature stay inside this file: they are never logged, stored, audited or put in an error message.
 */

const API_BASE = "https://api.passimpay.io/v2";
const TIMEOUT_MS = 10_000;
const NOT_AVAILABLE = "Payment provider is not available";

/** What PassimPay accepts as an order id: at most 64 characters from this set. A Payment id (24 hex characters) always fits. */
export const PASSIMPAY_ORDER_ID = /^[A-Za-z0-9+/=\-:.,_]{1,64}$/;

export type PassimpayStatus = { status: "paid" | "wait" | "error"; amountPaid: number | null; currency: string | null };

/** The two environment values, or null when either is missing (the provider is then off). */
export function passimpayConfig(): { platformId: number; apiKey: string } | null {
  const platformId = Number((process.env.PASSIMPAY_PLATFORM_ID ?? "").trim());
  const apiKey = (process.env.PASSIMPAY_API_KEY ?? "").trim();
  if (!Number.isInteger(platformId) || platformId < 1 || !apiKey) return null;
  return { platformId, apiKey };
}

/** Hex HMAC-SHA256 of "platformId;body;key" with the key: the body is exactly the string that is sent. */
export function signBody(platformId: number, bodyJson: string, apiKey: string): string {
  return hmacSha256(apiKey, `${platformId};${bodyJson};${apiKey}`);
}

/** Serialises once, signs that string and sends that same string. Every failure is the same plain error. */
async function call(path: "createorder" | "orderstatus", payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const config = passimpayConfig();
  if (!config) throw new InternalError(NOT_AVAILABLE);
  const body = JSON.stringify({ platformId: config.platformId, ...payload });
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": signBody(config.platformId, body, config.apiKey) },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await res.json()) as Record<string, unknown> | null;
    if (!res.ok || !data || typeof data !== "object" || data.result !== 1) throw new Error("refused");
    return data;
  } catch {
    throw new InternalError(NOT_AVAILABLE);
  }
}

/** Opens a crypto invoice for the price in rupees and returns the page the buyer pays on. */
export async function createInvoice(input: { orderId: string; amountInr: number }): Promise<{ url: string }> {
  if (!PASSIMPAY_ORDER_ID.test(input.orderId) || !Number.isFinite(input.amountInr) || input.amountInr <= 0) throw new InternalError(NOT_AVAILABLE);
  const data = await call("createorder", { orderId: input.orderId, amount: input.amountInr.toFixed(2), symbol: "INR", type: 1 });
  const url = typeof data.url === "string" ? data.url : "";
  if (!/^https:\/\/[^\s]+$/.test(url)) throw new InternalError(NOT_AVAILABLE);
  return { url };
}

/** What PassimPay itself says about an order. The webhook body is never trusted: this answer is. */
export async function orderStatus(orderId: string): Promise<PassimpayStatus> {
  const data = await call("orderstatus", { orderId });
  const status = data.status === "paid" || data.status === "wait" || data.status === "error" ? data.status : "wait";
  const amount = Number(data.amountPaid);
  return {
    status,
    amountPaid: Number.isFinite(amount) ? amount : null,
    currency: typeof data.currency === "string" ? data.currency.toUpperCase() : null,
  };
}

/** The webhook signature over the body as received; if that fails, over the same JSON re-serialised (the docs do not say how the body is written). */
export function verifyWebhookSignature(raw: string, header: string | null | undefined): { ok: boolean; form: "raw" | "reserialized" | null } {
  const config = passimpayConfig();
  const given = (header ?? "").trim();
  if (!config || !given) return { ok: false, form: null };
  if (safeEqual(given, signBody(config.platformId, raw, config.apiKey))) return { ok: true, form: "raw" };
  try {
    const again = JSON.stringify(JSON.parse(raw));
    if (again !== raw && safeEqual(given, signBody(config.platformId, again, config.apiKey))) return { ok: true, form: "reserialized" };
  } catch {
    /* not JSON: only the raw form could match */
  }
  return { ok: false, form: null };
}

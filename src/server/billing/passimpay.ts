import { createHmac, timingSafeEqual } from "node:crypto";
import { InternalError } from "@/server/http";

/**
 * H18.1: PassimPay crypto checkout (https://passimpay.gitbook.io/passimpay-api).
 * Env names only: PASSIMPAY_PLATFORM_ID, PASSIMPAY_API_KEY. The key is never logged, returned or stored.
 * Every request is signed: x-signature = hex HMAC-SHA256(key = API key, message = platformId;body;API key),
 * where body is exactly the JSON string that is sent.
 */

const API = "https://api.passimpay.io/v2";
const TIMEOUT_MS = 10_000;
export const NOT_AVAILABLE = "Payment provider is not available";

export type PassimpayStatus = "paid" | "wait" | "error";

function credentials() {
  const platformId = Number(process.env.PASSIMPAY_PLATFORM_ID?.trim());
  const apiKey = process.env.PASSIMPAY_API_KEY?.trim() ?? "";
  if (!Number.isInteger(platformId) || platformId <= 0 || !apiKey) throw new InternalError(NOT_AVAILABLE);
  return { platformId, apiKey };
}

export function passimpayConfigured() {
  const platformId = Number(process.env.PASSIMPAY_PLATFORM_ID?.trim());
  return Number.isInteger(platformId) && platformId > 0 && Boolean(process.env.PASSIMPAY_API_KEY?.trim());
}

/** The signature PassimPay expects for a body string. Exported for tests. */
export function passimpaySignature(platformId: number | string, body: string, apiKey: string) {
  return createHmac("sha256", apiKey).update(`${platformId};${body};${apiKey}`).digest("hex");
}

async function post<T>(path: string, payload: Record<string, unknown>, fetchImpl: typeof fetch): Promise<T> {
  const { platformId, apiKey } = credentials();
  const body = JSON.stringify({ platformId, ...payload });
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(`${API}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": passimpaySignature(platformId, body, apiKey) },
      body,
      signal,
    });
  } catch {
    throw new InternalError(NOT_AVAILABLE);
  }
  const data = (await response.json().catch(() => null)) as (T & { result?: number }) | null;
  if (!data || data.result !== 1) throw new InternalError(NOT_AVAILABLE);
  return data;
}

/** Order ids PassimPay accepts: at most 64 of A-Z a-z 0-9 + / = - : . , _ */
export function validOrderId(orderId: string) {
  return /^[A-Za-z0-9+/=\-:.,_]{1,64}$/.test(orderId);
}

/** Creates the hosted invoice (crypto only) for an amount in rupees and returns the page the buyer pays on. */
export async function createInvoice(input: { orderId: string; amountInr: number }, fetchImpl: typeof fetch = fetch) {
  if (!validOrderId(input.orderId) || !(input.amountInr > 0)) throw new InternalError(NOT_AVAILABLE);
  const data = await post<{ url?: string }>("createorder", { orderId: input.orderId, amount: input.amountInr.toFixed(2), symbol: "INR", type: 1 }, fetchImpl);
  if (!data.url || !/^https:\/\//.test(data.url)) throw new InternalError(NOT_AVAILABLE);
  return { url: data.url };
}

/** Asks PassimPay what an invoice's status is. This, never a notice's body, decides whether credits are added. */
export async function orderStatus(orderId: string, fetchImpl: typeof fetch = fetch): Promise<{ status: PassimpayStatus; amountPaid: number; currency: string }> {
  if (!validOrderId(orderId)) throw new InternalError(NOT_AVAILABLE);
  const data = await post<{ status?: string; amountPaid?: string; currency?: string }>("orderstatus", { orderId }, fetchImpl);
  const status = data.status === "paid" || data.status === "wait" || data.status === "error" ? data.status : "wait";
  return { status, amountPaid: Number(data.amountPaid) || 0, currency: String(data.currency ?? "").toUpperCase() };
}

function sameHex(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Checks a notice's x-signature. PassimPay's docs leave the body form vague, so the raw body and the re-serialised body are
 * both tried. A valid notice only triggers orderStatus(); it never credits by itself.
 */
export function verifyNotice(raw: string, given: string | null): { ok: boolean; orderId: string | null } {
  if (!given || !passimpayConfigured()) return { ok: false, orderId: null };
  const { platformId, apiKey } = credentials();
  let parsed: { orderId?: unknown } | null = null;
  try {
    parsed = JSON.parse(raw) as { orderId?: unknown };
  } catch {
    return { ok: false, orderId: null };
  }
  const candidates = [raw, JSON.stringify(parsed)];
  const ok = candidates.some((body) => sameHex(given.trim().toLowerCase(), passimpaySignature(platformId, body, apiKey)));
  const orderId = typeof parsed?.orderId === "string" && validOrderId(parsed.orderId) ? parsed.orderId : null;
  return { ok, orderId };
}

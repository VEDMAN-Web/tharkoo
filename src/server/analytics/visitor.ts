import { randomBytes } from "node:crypto";
import { cookieSecure, readCookie } from "@/server/auth/http";
import { hmacSha256 } from "@/server/shared/crypto";

/** H6.17: first-party visitor cookie. Random, one year, never read by page code. */
export const VISITOR_COOKIE = "tk_vid";
export const VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const VISITOR_ID = /^[A-Za-z0-9_-]{16,64}$/;

export function newVisitorId(): string {
  return randomBytes(16).toString("base64url");
}

export function visitorCookieFrom(request: Request): string | undefined {
  const value = readCookie(request, VISITOR_COOKIE);
  return value && VISITOR_ID.test(value) ? value : undefined;
}

function keySecret(): string {
  return process.env.SESSION_SECRET?.trim() || "tharkoo-visitor-key";
}

/**
 * The only visitor value stored in an AdEvent row: an HMAC. A signed-in person is keyed by user id, everyone else by the cookie.
 * Returns null when neither is known.
 */
export function visitorKeyFor(input: { userId?: string; cookieId?: string }): string | null {
  if (input.userId) return hmacSha256(keySecret(), `user:${input.userId}`);
  if (input.cookieId) return hmacSha256(keySecret(), `visitor:${input.cookieId}`);
  return null;
}

export function visitorCookieHeader(id: string, secure = cookieSecure()): string {
  return [
    `${VISITOR_COOKIE}=${id}`,
    "Path=/",
    `Max-Age=${VISITOR_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "HttpOnly",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

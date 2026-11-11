import { ForbiddenError } from "@/server/http";
import { hmacSha256, sha256 } from "@/server/shared/crypto";

export const SESSION_COOKIE = "sid";
export const SESSION_MS = 1000 * 60 * 60 * 24 * 14;
export const SESSION_MAX_AGE = Math.floor(SESSION_MS / 1000);
export const RATE_WINDOW_MS = 1000 * 60 * 15;
/** Five failures are allowed. The sixth attempt is rejected. */
export const LOGIN_MAX = 5;

export function hashToken(token: string) {
  const secret = process.env.SESSION_SECRET?.trim();
  return secret ? hmacSha256(secret, token) : sha256(token);
}

export function cookieSecure() {
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export const SESSION_HINT = "tk-in";

export function sessionCookieHeader(token: string, secure = cookieSecure()) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Readable flag so public pages can skip account fetches when nobody is signed in. */
export function sessionHintCookie(secure = cookieSecure()) {
  const parts = [`${SESSION_HINT}=1`, "Path=/", "SameSite=Lax", `Max-Age=${SESSION_MAX_AGE}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(secure = cookieSecure()) {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionHintCookie(secure = cookieSecure()) {
  const parts = [`${SESSION_HINT}=`, "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function siteOrigin() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://127.0.0.1:4317";
  return raw.replace(/\/$/, "");
}

export function allowedOrigins() {
  const values = [process.env.SITE_URL, process.env.NEXT_PUBLIC_SITE_URL];
  if (process.env.NODE_ENV !== "production") {
    values.push("http://127.0.0.1:4317", "http://localhost:4317");
  }
  return new Set(
    values.filter((value): value is string => Boolean(value)).map((value) => value.replace(/\/$/, "")),
  );
}

export function originAllowed(request: { method: string; headers: Headers }) {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return true;
  const source = request.headers.get("origin") || request.headers.get("referer");
  if (!source) return false;
  let origin: URL;
  try {
    origin = new URL(source);
  } catch {
    return false;
  }
  if (allowedOrigins().has(origin.origin)) return true;
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    ?.trim();
  return Boolean(host) && origin.host === host;
}

export function assertOrigin(request: Request) {
  if (!originAllowed(request)) throw new ForbiddenError("Origin is not allowed");
}

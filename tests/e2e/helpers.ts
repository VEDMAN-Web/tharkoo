import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, request, test as base, type APIRequestContext, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";

export const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL || "homepage-admin@example.test";
export const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || "HomepageAdmin1!";
export const USER_PASSWORD = "E2ePass1!xyz";

// 1x1 PNG, enough for the photo and ID uploads.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Same as the stock test, but the age gate and cookie banner never block a page. */
/**
 * Each test gets its own client address: the site limits registrations per address (20 per 15 minutes)
 * and trusts the last X-Forwarded-For entry, so a fresh one keeps the suite independent of earlier runs.
 */
export function freshIp() {
  const part = () => 1 + Math.floor(Math.random() * 253);
  return `10.${part()}.${part()}.${part()}`;
}

/** A plain API client with its own address. */
export function newApi(baseURL: string) {
  return request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
}

export const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": freshIp() });
  },
  context: async ({ context }, provide) => {
    await context.addInitScript(() => {
      localStorage.setItem("nl-age", "ok");
      localStorage.setItem("nl-cookies", "necessary");
    });
    await provide(context);
  },
});
export { expect };

export function uniqueEmail(prefix: string) {
  return `${prefix}+${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;
}

/** Headers the origin check on POST routes expects. */
export function originHeaders(baseURL: string, referer = "/") {
  return { origin: baseURL, referer: baseURL + referer };
}

export function baseUrlOf(page: Page) {
  const url = new URL(page.url() === "about:blank" ? "http://127.0.0.1:4342" : page.url());
  return url.origin;
}

export async function registerApi(api: APIRequestContext, baseURL: string, email: string, password = USER_PASSWORD) {
  const res = await api.post("/api/auth/register", {
    headers: originHeaders(baseURL),
    data: { email, password, displayName: "E2E", dateOfBirth: "1990-01-01", acceptedTerms: true, attestedAdult: true },
  });
  expect(res.status(), await res.text()).toBe(201);
}

export async function loginApi(api: APIRequestContext, baseURL: string, email: string, password = USER_PASSWORD) {
  const res = await api.post("/api/auth/login", { headers: originHeaders(baseURL, "/u/login/"), data: { email, password } });
  expect(res.status(), await res.text()).toBe(200);
}

/**
 * A signed-in admin API client. Logins are limited to 5 per 15 minutes per account, so the session is
 * saved to .shots/e2e/ and reused while it still works.
 */
export async function adminApi(baseURL: string) {
  const file = resolve(".shots/e2e/admin-state.json");
  if (existsSync(file)) {
    const saved = await request.newContext({ baseURL, storageState: file, extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
    const me = await saved.get("/api/auth/me");
    if (me.status() === 200) return saved;
    await saved.dispose();
  }
  const api = await newApi(baseURL);
  await loginApi(api, baseURL, ADMIN_EMAIL, ADMIN_PASSWORD);
  mkdirSync(dirname(file), { recursive: true });
  await api.storageState({ path: file });
  return api;
}

/** A signed-in client for a fresh, verified account. */
export async function newUserApi(baseURL: string, prefix = "user") {
  const api = await newApi(baseURL);
  const email = uniqueEmail(prefix);
  await registerApi(api, baseURL, email);
  await loginApi(api, baseURL, email);
  return { api, email };
}

/** Sign in through the real login page. */
export async function loginUi(page: Page, email: string, password = USER_PASSWORD, next = "") {
  await page.goto(`/u/login/${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "LOG IN" }).click();
}

/** Visible-or-not safe text of the page, scripts and styles removed. */
export function visibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Promote an existing account to a staff role by writing to the in-memory test database.
 * The URI file is written by tests/e2e/server.mjs. Returns false when it is not available.
 */
export async function setRoles(email: string, roles: string[]) {
  const file = resolve(process.env.E2E_MONGO_URI_FILE || ".shots/e2e/mongo-uri.txt");
  let uri = "";
  try {
    uri = readFileSync(file, "utf8").trim();
  } catch {
    return false;
  }
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) throw new Error("Refusing to touch a non-local database");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const res = await client.db("tharkoo").collection("users").updateOne({ email: email.toLowerCase() }, { $set: { roles } });
    return res.matchedCount === 1;
  } finally {
    await client.close();
  }
}

export async function hasHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

export function isPhone(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

/** The first listing path (one that has a contact method) found on a city feed, e.g. /ad/demo-0352/. */
export async function firstAdPath(page: Page, feed = "/dating/bengaluru/") {
  await page.goto(feed);
  const link = page.locator("[data-tk=card][data-contact='1'] a[href*=\"/ad/\"]").first();
  await link.waitFor({ state: "attached" });
  return (await link.getAttribute("href")) as string;
}

export const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "e2e-webhook-secret-not-real";

/** Confirms a mock payment the way the provider does: a signed webhook. */
export async function confirmPayment(baseURL: string, providerRef: string, { withOrigin = true } = {}) {
  // A fresh client: the provider sends no cookies. A real provider also sends no Origin header
  // (BUG 5 in lane-d-bugs: the site rejects that), so the tests add one by default.
  const api = await newApi(baseURL);
  const raw = JSON.stringify({ eventId: `evt_${providerRef}`, status: "paid", providerRef });
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
  const res = await api.post("/api/payments/webhook/", {
    headers: { "content-type": "application/json", "x-payment-signature": signature, ...(withOrigin ? { origin: baseURL } : {}) },
    data: raw,
  });
  expect(res.status(), await res.text()).toBe(200);
  await api.dispose();
}

/** Gives a browser context the saved admin session (log in once, see adminApi). */
export async function signInAdminContext(context: import("@playwright/test").BrowserContext, baseURL: string) {
  const api = await adminApi(baseURL);
  const state = await api.storageState();
  await api.dispose();
  await context.addCookies(state.cookies);
}

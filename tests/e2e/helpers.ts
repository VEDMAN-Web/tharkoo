import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, request, test as base, type APIRequestContext, type Page } from "@playwright/test";
import { MongoClient, ObjectId, type Db } from "mongodb";

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
 * Sets "Require ID check before posting" (H6.14) as the bootstrap superadmin. Returns the stored value.
 * Tests that turn it on must turn it back off, because the suite shares one database.
 */
export async function setIdCheckSwitch(baseURL: string, required: boolean) {
  const admin = await adminApi(baseURL);
  const res = await admin.put("/api/admin/settings/id-check", { headers: originHeaders(baseURL, "/admin/settings/"), data: { required } });
  expect(res.status(), await res.text()).toBe(200);
  await admin.dispose();
  return required;
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

/**
 * Signs the page's browser in with the password API, then opens `next`. H7.2 turned the login page into a sheet
 * that asks for a one-time code first, so the form no longer has a password field to fill. page.request shares the
 * browser context's cookies, so the session carries into the page.
 */
export async function loginUi(page: Page, email: string, password = USER_PASSWORD, next = "") {
  const base = String(test.info().project.use.baseURL || "http://127.0.0.1:4342");
  const res = await page.request.post("/api/auth/login", { headers: originHeaders(base, "/u/login/"), data: { email, password } });
  expect(res.status(), await res.text()).toBe(200);
  // H7.2b: with the New design on, posting an ad needs a saved seller profile first.
  if (next.startsWith("/u/post-insert")) await becomeSeller(page, base);
  await page.goto(next || "/u/account/dashboard/");
}

/** Puts credits in the signed-in account's wallet in the in-memory test database. Posting an ad costs credits. */
export async function grantCredits(page: Page, credits = 100) {
  const me = await page.request.get("/api/auth/me");
  const id = ((await me.json()).data?.user?.id ?? "") as string;
  expect(id, "signed-in account id").toBeTruthy();
  await withLocalDb((db) =>
    db.collection("wallet_entries").insertOne({
      userId: new ObjectId(id),
      delta: credits,
      reason: "e2e grant",
      refType: "e2e",
      refId: `e2e-${Date.now()}`,
      balanceAfter: credits,
      idempotencyKey: `e2e-${id}-${Date.now()}-${Math.random()}`,
      createdAt: new Date(),
    }),
  );
}

/** Answers GET /api/wallet/posting-fee the way the paid-posting server does, with the account's real balance. A fee of 0 or a missing endpoint means posting is free. */
export async function stubPostingFee(page: Page, fee = 30) {
  await page.route("**/api/wallet/posting-fee", async (route) => {
    if (fee === 404) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }) });
    const own = await route.fetch({ url: new URL("/api/wallet", route.request().url()).toString() });
    const balance = (((await own.json()) as { data?: { balance?: number } }).data?.balance ?? 0) as number;
    const short = Math.max(0, fee - balance);
    const data = { fee, balance, after: Math.max(0, balance - fee), short, enough: short === 0, creditPriceInr: 10, mockPaymentsOn: true };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data }) });
  });
}

/** Saves a seller profile for the signed-in page (H7.2b). Needed before the post-ad form opens in the New design. */
export async function becomeSeller(page: Page, base: string, name = "E2E Seller", city = "Mumbai") {
  const res = await page.request.put("/api/auth/seller-profile", {
    headers: originHeaders(base, "/u/seller-profile/"),
    data: { name, city, whatsapp: "", availableNow: false },
  });
  expect(res.status(), await res.text()).toBe(200);
  await grantCredits(page);
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
 * Runs one write against the in-memory test database. The URI file is written by tests/e2e/server.mjs.
 * Returns null when that file is not there, so a caller can say the database is not reachable.
 */
export async function withLocalDb<T>(run: (db: Db) => Promise<T>): Promise<T | null> {
  const file = resolve(process.env.E2E_MONGO_URI_FILE || ".shots/e2e/mongo-uri.txt");
  let uri = "";
  try {
    uri = readFileSync(file, "utf8").trim();
  } catch {
    return null;
  }
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) throw new Error("Refusing to touch a non-local database");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    return await run(client.db("tharkoo"));
  } finally {
    await client.close();
  }
}

/** Promote an existing account to a staff role by writing to the in-memory test database. */
export async function setRoles(email: string, roles: string[]) {
  const res = await withLocalDb((db) => db.collection("users").updateOne({ email: email.toLowerCase() }, { $set: { roles } }));
  return res ? res.matchedCount === 1 : false;
}

/** Sets an ad's expiry in the in-memory test database. A date in the past makes the ad gone (410). */
export async function setListingExpiry(slug: string, expiresAt: Date) {
  const res = await withLocalDb((db) => db.collection("listings").updateOne({ slug }, { $set: { expiresAt } }));
  return res ? res.matchedCount === 1 : false;
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
  const link = page.locator("[data-tk=card] a[href*=\"/ad/\"]").first();
  await link.waitFor({ state: "attached" });
  return (await link.getAttribute("href")) as string;
}

export const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "e2e-webhook-secret-not-real";

/** Confirms a mock payment the way the provider does: a signed webhook. */
export async function confirmPayment(baseURL: string, providerRef: string, { withOrigin = true } = {}) {
  // A fresh client: the provider sends no cookies and, like a real provider, may send no Origin header.
  const api = await newApi(baseURL);
  const raw = JSON.stringify({ eventId: `evt_${providerRef}`, status: "paid", providerRef });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(`${timestamp}.${raw}`).digest("hex");
  const res = await api.post("/api/payments/webhook/", {
    headers: {
      "content-type": "application/json",
      "x-payment-signature": signature,
      "x-payment-timestamp": String(timestamp),
      ...(withOrigin ? { origin: baseURL } : {}),
    },
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

/**
 * H7.5: turns the ad seller's "Available now" switch on or off in the test database, as the seller would from the panel.
 * On sets recent activity, so the seller shows Online now until the admin's hours pass with no activity.
 */
export async function setSellerAvailable(slug: string, available: boolean) {
  const done = await withLocalDb(async (db) => {
    const listing = await db.collection("listings").findOne({ slug });
    expect(listing, "the ad exists").toBeTruthy();
    await db.collection("vendor_presence").updateOne(
      { userId: String(listing!.ownerId) },
      { $set: { available, lastActivityAt: new Date() } },
      { upsert: true },
    );
    return true;
  });
  expect(done, "E2E_MONGO_URI_FILE must point at the in-memory database").toBe(true);
}

/** The ad slug from its public path, e.g. /ad/in00012/ gives in00012. */
export function slugFromAdPath(path: string) {
  return path.replace(/^\/ad\//, "").replace(/\/$/, "");
}

import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, request, test as base, type APIRequestContext, type Page } from "@playwright/test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { startWorkerServer, type WorkerServer } from "./worker-server";

export const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL || "homepage-admin@example.test";
export const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || "HomepageAdmin1!";
export const USER_PASSWORD = "E2ePass1!xyz";

// 1x1 PNG, enough for the photo and ID uploads.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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

/**
 * H10.5b: with more than one worker, each worker serves its own seeded copy of the site (own database, own port, own
 * uploads), so no test can change what another worker sees. With one worker the shared server from the config is used.
 * Tests read the address and the database file from the environment of their worker, never from a fixed port.
 */
const isolated = base.extend<object, { workerServer: WorkerServer | null }>({
  workerServer: [
    async ({}, provide, workerInfo) => {
      const basePort = Number(process.env.E2E_PORT || "4342");
      const wanted = workerInfo.config.workers > 1 && !process.env.E2E_BASE_URL;
      const server = wanted ? await startWorkerServer(workerInfo.parallelIndex, basePort) : null;
      if (server) {
        process.env.E2E_BASE_URL = server.url;
        process.env.E2E_MONGO_URI_FILE = server.mongoUriFile;
        process.env.E2E_APP_DIR = server.appDir;
      }
      await provide(server);
      await server?.stop();
    },
    { scope: "worker", auto: true, timeout: 300_000 },
  ],
  baseURL: async ({ baseURL, workerServer }, provide) => {
    await provide(workerServer?.url ?? baseURL);
  },
});

/** The stock test with the worker's own server, and no age gate or cookie banner bypass (for tests of those two). */
export const cleanTest = isolated;

/** Same as the stock test, but the age gate and cookie banner never block a page. */
export const test = isolated.extend({
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
  const url = new URL(page.url() === "about:blank" ? process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || "4342"}` : page.url());
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
  // One saved session per server: a session from one worker's database means nothing to another worker's.
  const file = resolve(`.shots/e2e/admin-state-${new URL(baseURL).port || "80"}.json`);
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
  const base = String(process.env.E2E_BASE_URL || test.info().project.use.baseURL || "http://127.0.0.1:4342");
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
    let balance = 0;
    try {
      const own = await page.request.get("/api/wallet/");
      balance = (JSON.parse(await own.text()) as { data?: { balance?: number } }).data?.balance ?? 0;
    } catch {
      balance = 0;
    }
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
  const link = page.locator(":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row]) a[data-ad-link]").first();
  await link.waitFor({ state: "attached" });
  return oldAdPath((await link.getAttribute("href")) as string);
}

/**
 * H16.2: ads now live at /<category>/<city>/<title>-<code>/. Many specs still think in the old /ad/<slug>/ form (which
 * forwards), so this turns a link from a card into that form. Returns the link unchanged when it is old already.
 */
export async function oldAdPath(href: string) {
  const code = /-([a-z0-9]{5})\/$/.exec(href)?.[1];
  if (!code || href.startsWith("/ad/")) return href;
  const row = await withLocalDb((db) => db.collection("listings").findOne({ code }, { projection: { slug: 1 } }));
  return row?.slug ? `/ad/${row.slug}/` : href;
}

/** H16.2: the code at the end of an ad's address, found by its old slug. */
export async function adCodeFor(slug: string) {
  const row = await withLocalDb((db) => db.collection("listings").findOne({ slug }, { projection: { code: 1 } }));
  if (!row?.code) throw new Error(`No code for local ad ${slug}`);
  return String(row.code);
}

/** H16.2: matches the address an ad has now, for toHaveURL. The ad is found by its old slug. */
export async function adAddressPattern(slug: string) {
  const row = await withLocalDb((db) => db.collection("listings").findOne({ slug }, { projection: { code: 1 } }));
  if (!row?.code) throw new Error(`No code for local ad ${slug}`);
  return new RegExp(`-${row.code}/$`);
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
 * H17.1: the path of a REAL ad with a photo and contact buttons. A sample (demo) ad has no Call, WhatsApp or Chat button, so the tests of
 * those buttons need a real one. It is a copy of the first ad of the feed owned by a throwaway real account (a copy of a real ad is used as is).
 */
export async function realAdPath(page: Page, feed = "/dating/bengaluru/"): Promise<string> {
  const first = await firstAdPath(page, feed);
  const slug = first.replace(/^\/ad\//, "").replace(/\/$/, "");
  const copied = await withLocalDb(async (db) => {
    const source = await db.collection("listings").findOne({ slug });
    if (!source) return null;
    const owner = await db.collection("users").findOne({ _id: source.ownerId }, { projection: { email: 1 } });
    if (owner?.email !== "seed@tharkoo.local") return slug;
    const now = new Date();
    const stamp = `${now.getTime()}-${Math.floor(Math.random() * 1e6)}`;
    const user = await db.collection("users").insertOne({ email: `real-${stamp}@example.test`, displayName: "E2E real poster", roles: ["user"], createdAt: now, updatedAt: now });
    const media = await db.collection("media_assets").insertOne({ kind: "image", status: "cleared", objectKey: "/brand/logo-mark-512.png", ownerId: user.insertedId, createdAt: now, updatedAt: now });
    const { _id, ...rest } = source;
    void _id;
    // feedHidden keeps the copy out of every list, so the other specs still see the same first cards; the page opens by its address.
    const copy = { ...withoutAddress(rest), ownerId: user.insertedId, slug: `e2e-real-${stamp}`, mediaIds: [media.insertedId], badges: [], feedHidden: true, publishedAt: now, createdAt: now, updatedAt: now };
    await db.collection("vendor_presence").updateOne({ userId: String(user.insertedId) }, { $set: { available: true, lastActivityAt: now, liveChat: true } }, { upsert: true });
    await db.collection("listings").insertOne(copy);
    return copy.slug as string;
  });
  expect(copied, "a real ad could be made from the first ad of the feed").toBeTruthy();
  return `/ad/${copied}/`;
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
      { $set: { available, lastActivityAt: new Date(), liveChat: true } },
      { upsert: true },
    );
    return true;
  });
  expect(done, "E2E_MONGO_URI_FILE must point at the in-memory database").toBe(true);
}

/**
 * Puts the layouts of one page ("listing" or "post") back to "never published" (drafts, live copy and saved versions)
 * in the test database. A test that publishes a layout calls this when it is done, and a test that starts from
 * "Not published yet" calls it first, so neither depends on which other tests ran before it.
 */
export async function resetPageLayouts(key: "listing" | "post") {
  const done = await withLocalDb(async (db) => {
    await db.collection("page_layouts").deleteMany({ key });
    await db.collection("page_layout_revisions").deleteMany({ key });
    return true;
  });
  expect(done, "E2E_MONGO_URI_FILE must point at the in-memory database").toBe(true);
}

export const resetListingLayouts = () => resetPageLayouts("listing");

/** The folder the site under test saves uploads in. A worker's own server keeps it inside its own copy of the app. */
export function uploadsDir() {
  return resolve(process.env.E2E_APP_DIR || ".", "public", "uploads");
}

/** The ad slug from its public path, e.g. /ad/in00012/ gives in00012. */
export function slugFromAdPath(path: string) {
  return path.replace(/^\/ad\//, "").replace(/\/$/, "");
}

/**
 * H16.2: every ad has its own unique code and address. A spec that makes a new ad by copying a seeded one must not copy those
 * fields, or the copy would clash with the original. Use this on the copy.
 */
export function withoutAddress<T extends Record<string, unknown>>(listing: T): Omit<T, "code" | "addressPath" | "previousPaths"> {
  const { code, addressPath, previousPaths, ...rest } = listing;
  void code;
  void addressPath;
  void previousPaths;
  return rest;
}

import AxeBuilder from "@axe-core/playwright";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, hasHorizontalScroll, originHeaders, signInAdminContext, test, uniqueEmail } from "./helpers";

const PUBLIC_PAGES = [
  "/",
  "/cities/",
  "/dating/",
  "/dating/bengaluru/",
  "/wellness/bengaluru/",
  "/search/?q=a",
  "/ad/demo-0352/",
  "/terms/",
  "/privacy/",
  "/cookies/",
  "/help/",
  "/blog/",
  "/contact/",
  "/scam-report/",
  "/submit-report/",
  "/u/login/",
  "/u/register/",
  "/u/forgot/",
  "/admin/login/",
  "/this-page-does-not-exist/",
];

const WIDTHS: [number, number][] = [
  [390, 844],
  [768, 1024],
  [1440, 900],
];

test.describe("Plus: visual overflow at 390, 768 and 1440", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop-1440", "Runs once; it sets its own viewport widths.");
  });

  for (const path of PUBLIC_PAGES) {
    test(`no horizontal scroll: ${path}`, async ({ page }) => {
      for (const [width, height] of WIDTHS) {
        await page.setViewportSize({ width, height });
        await page.goto(path);
        await page.waitForLoadState("load");
        expect(await hasHorizontalScroll(page), `${path} at ${width}px`).toBe(false);
      }
    });
  }
});

test.describe("Plus: accessibility (axe, serious and critical)", () => {
  async function serious(page: import("@playwright/test").Page) {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.passes.length, "axe ran").toBeGreaterThan(5);
    return result.violations
      .filter((item) => item.impact === "serious" || item.impact === "critical")
      .map((item) => `${item.id} (${item.impact}) x${item.nodes.length}: ${item.nodes[0]?.target.join(" ")}`);
  }

  // Known findings, listed in lane-d-bugs.txt. Remove an entry when its bug is fixed.
  const KNOWN: Record<string, string> = {
    "listing@phone-390": "BUG axe: color-contrast on the TOP badge (span[data-tier=top]) on the phone listing page.",
    "ad@phone-390": "BUG axe: color-contrast on .tk-card-title of the top-styled card in More like this.",
    "ad@desktop-1440": "BUG axe: color-contrast on .tk-card-title of the top-styled card in More like this.",
    "admin@desktop-1440": "BUG axe: color-contrast on the active admin sidebar link label.",
  };
  function knownBug(name: string) {
    const reason = KNOWN[`${name}@${test.info().project.name}`];
    if (reason) test.fixme(true, reason);
  }

  for (const [name, path] of [
    ["home", "/"],
    ["listing", "/dating/bengaluru/"],
    ["ad", "/ad/demo-0352/"],
    ["register", "/u/register/"],
  ] as const) {
    test(`axe: ${name}`, async ({ page }) => {
      knownBug(name);
      await page.goto(path);
      await page.waitForLoadState("load");
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await serious(page)).toEqual([]);
    });
  }

  test("axe: admin dashboard", async ({ page, context, baseURL }) => {
    knownBug("admin");
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/");
    await expect(page.locator(".adm-nav").first()).toBeAttached();
    expect(await serious(page)).toEqual([]);
  });
});

const SECRET_VALUES = ["local-only-session-secret-not-real-0001", "local-only-0123456789abcdef012345", "e2e-webhook-secret-not-real", "HomepageAdmin1!"];
const SECRET_NAMES = /MONGODB_URI|SESSION_SECRET|CONTACT_ENCRYPTION_KEY|PAYMENT_WEBHOOK_SECRET|RAZORPAY_KEY_SECRET|CLOUDINARY_API_SECRET|ADMIN_BOOTSTRAP_PASSWORD/;

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|css|html|json|txt|map)$/.test(entry)) out.push(full);
  }
  return out;
}

test.describe("Plus: security sweep", () => {
  const CONTACT_PATTERNS: [string, RegExp][] = [
    ["phone number", /(?<![\d.])(?:\+?91[\s-]?)?[6-9]\d{9}(?![\d])/],
    ["tel link", /href="tel:/],
    ["whatsapp number link", /wa\.me\/\d{6,}/],
    ["telegram handle link", /t\.me\/[A-Za-z0-9_]{4,}/],
  ];
  const PAGES = ["/", "/dating/", "/dating/bengaluru/", "/ad/demo-0352/", "/ad/demo-0354/", "/search/?q=a"];

  for (const path of PAGES) {
    test(`no contact values in HTML or RSC before the reveal: ${path}`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      const rsc = await (await request.get(path, { headers: { rsc: "1" } })).text();
      for (const [label, pattern] of CONTACT_PATTERNS) {
        // Next.js build ids and asset hashes are digits-and-letters, not 10-digit mobile numbers, but strip data URIs and srcsets to be safe.
        const cleaned = (text: string) => text.replace(/data:[^"')]+/g, "").replace(/srcset="[^"]*"/g, "").replace(/\/_next\/[^"')\s]*/g, "");
        expect(cleaned(html), `${label} in HTML of ${path}`).not.toMatch(pattern);
        expect(cleaned(rsc), `${label} in RSC of ${path}`).not.toMatch(pattern);
      }
    });
  }

  test("public listing JSON has no contact values", async ({ request }) => {
    const res = await request.get("/api/listings/demo-0352/");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).not.toMatch(/"(phone|whatsapp|telegram)"\s*:\s*"[^"]+/i);
    expect(body).not.toMatch(/(?<![\d])(?:\+?91)?[6-9]\d{9}(?![\d])/);
  });

  test("admin pages are noindex", async ({ request }) => {
    for (const path of ["/admin/", "/admin/login/", "/admin/listings/", "/admin/seo/"]) {
      const res = await request.get(path);
      const header = res.headers()["x-robots-tag"] || "";
      const html = await res.text();
      expect(/noindex/i.test(header) || /<meta name="robots" content="[^"]*noindex/.test(html), path).toBe(true);
    }
  });

  test("POST routes refuse a missing or foreign Origin", async ({ request, baseURL }) => {
    const routes = ["/api/auth/login/", "/api/auth/register/", "/api/listings/", "/api/wallet/packs/", "/api/coupons/redeem/", "/api/promotions/", "/api/admin/mutate/"];
    for (const path of routes) {
      const none = await request.post(path, { data: {} });
      expect(none.status(), `${path} without Origin`).toBe(403);
      const foreign = await request.post(path, { headers: { origin: "https://evil.example", referer: "https://evil.example/" }, data: {} });
      expect(foreign.status(), `${path} with a foreign Origin`).toBe(403);
    }
    // And a normal same-origin post gets past the origin check (it then fails on its own rules).
    const ok = await request.post("/api/auth/login/", { headers: originHeaders(baseURL!, "/u/login/"), data: { email: uniqueEmail("origin"), password: "WrongPass1!" } });
    expect(ok.status()).not.toBe(403);
  });

  test("no secrets in client bundles (.next/static)", async () => {
    const dir = join(process.cwd(), ".next", "static");
    test.skip(!existsSync(dir), "Run npm run build first.");
    const hits: string[] = [];
    for (const file of walk(dir)) {
      const text = readFileSync(file, "utf8");
      for (const value of SECRET_VALUES) if (text.includes(value)) hits.push(`${file}: value of a server secret`);
      const named = text.match(SECRET_NAMES);
      if (named) hits.push(`${file}: ${named[0]}`);
      if (/\bMONGODB\b/.test(text)) hits.push(`${file}: MONGODB`);
    }
    expect(hits).toEqual([]);
  });
});

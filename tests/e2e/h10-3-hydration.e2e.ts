import type { Page } from "@playwright/test";
import { expect, loginUi, newUserApi, test, withLocalDb } from "./helpers";

/** H10.3: no page may log a hydration problem (React error 418, 423, 425 or "did not match") when it loads. */

const HYDRATION = /hydrat|did not match|server rendered|Minified React error #(418|423|425)/i;

function watch(page: Page) {
  const found: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      const text = message.text();
      if (HYDRATION.test(text)) found.push(`[${page.url()}] ${text.slice(0, 300)}`);
    }
  });
  page.on("pageerror", (error) => {
    if (HYDRATION.test(String(error))) found.push(`[${page.url()}] ${String(error).slice(0, 300)}`);
  });
  return found;
}

const PAGES = ["/", "/dating/", "/dating/bengaluru/", "/search/?q=a", "/cities/", "/categories/", "/blog/", "/help/", "/nope-404/"];

test.describe("H10.3 no hydration warnings", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const timezoneId of ["Asia/Kolkata", "UTC", "America/Los_Angeles"]) {
      test(`the Home page and the main pages load clean at ${size.width} in ${timezoneId}`, async ({ browser, baseURL }) => {
        test.setTimeout(240_000);
        const context = await browser.newContext({ baseURL, viewport: size, timezoneId, locale: timezoneId === "America/Los_Angeles" ? "en-US" : "en-IN" });
        const page = await context.newPage();
        const found = watch(page);
        for (const path of PAGES) {
          await page.goto(path, { waitUntil: "networkidle" });
          await page.waitForTimeout(800);
        }
        expect(found.join(" | "), "hydration warnings").toBe("");
        await context.close();
      });
    }
  }

  test("the server page says the same address as the browser: Home and a list page carry the Home strip, the current menu link and the right page address", async ({ request }) => {
    const home = await (await request.get("/")).text();
    expect(home).toContain('data-tk="top-bar"');
    expect(home).toContain('"@type":"WebPage","name":"Tharkoo"');
    expect(home).not.toContain("/index\"");
    const categories = await (await request.get("/categories/")).text();
    expect(categories).toContain("href=\"/categories/\"");
    expect(categories).toMatch(/aria-current="page"[^>]*href="[/]categories[/]"/);
    expect(categories).not.toContain('data-tk="top-bar"');
  });

  test("a first visit with live-like data (ads posted a few seconds, minutes, hours and a day ago) loads clean at both sizes", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const offsets = [59_000, 60_000, 61_000, 3_599_000, 3_600_000, 86_399_000, 86_400_000];
    const before = await withLocalDb(async (db) => {
      const rows = await db.collection("listings").find({ status: "active" }).sort({ _id: 1 }).limit(offsets.length).project({ publishedAt: 1, createdAt: 1, updatedAt: 1 }).toArray();
      const now = Date.now();
      for (const [index, row] of rows.entries()) {
        const at = new Date(now - offsets[index]);
        await db.collection("listings").updateOne({ _id: row._id }, { $set: { publishedAt: at, createdAt: at, updatedAt: at } });
      }
      return rows;
    });
    try {
      for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const context = await browser.newContext({ baseURL, viewport: size });
        const page = await context.newPage();
        const found = watch(page);
        await page.goto("/", { waitUntil: "networkidle" });
        await page.waitForTimeout(1500);
        await expect(page.getByText("Please confirm your age before continuing")).toBeVisible();
        expect(found.join(" | "), `live-like first visit at ${size.width}`).toBe("");
        await context.close();
      }
    } finally {
      await withLocalDb(async (db) => {
        for (const row of before ?? []) await db.collection("listings").updateOne({ _id: row._id }, { $set: { publishedAt: row.publishedAt, createdAt: row.createdAt, updatedAt: row.updatedAt } });
        return true;
      });
    }
  });

  test("a first visit (age gate and cookie notice shown), a visitor with saved and recent ads, and a signed-in visitor all load the Home page clean", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const first = await browser.newContext({ baseURL });
    const firstPage = await first.newPage();
    const foundFirst = watch(firstPage);
    await firstPage.goto("/", { waitUntil: "networkidle" });
    await firstPage.waitForTimeout(1200);
    await expect(firstPage.getByText("Please confirm your age before continuing")).toBeVisible();
    expect(foundFirst.join(" | "), "first visit").toBe("");
    await first.close();

    const saved = await browser.newContext({ baseURL });
    await saved.addInitScript(() => {
      localStorage.setItem("nl-age", "ok");
      localStorage.setItem("nl-cookies", "necessary");
      localStorage.setItem("tk-saved", JSON.stringify([{ id: "x", slug: "demo-1", title: "Saved ad", place: "Surat", at: Date.now() }]));
      localStorage.setItem("tk-recent", JSON.stringify([{ id: "y", slug: "demo-2", title: "Recent ad", place: "Surat", at: Date.now() }]));
      document.cookie = "tk-country=india; path=/";
    });
    const savedPage = await saved.newPage();
    const foundSaved = watch(savedPage);
    await savedPage.goto("/", { waitUntil: "networkidle" });
    await savedPage.waitForTimeout(1200);
    expect(foundSaved.join(" | "), "saved and recent ads").toBe("");
    await saved.close();

    const { api, email } = await newUserApi(baseURL!, "h103hyd");
    await api.dispose();
    const signed = await browser.newContext({ baseURL });
    await signed.addInitScript(() => {
      localStorage.setItem("nl-age", "ok");
      localStorage.setItem("nl-cookies", "necessary");
    });
    const signedPage = await signed.newPage();
    const foundSigned = watch(signedPage);
    await loginUi(signedPage, email);
    await signedPage.goto("/", { waitUntil: "networkidle" });
    await signedPage.waitForTimeout(1200);
    expect(foundSigned.join(" | "), "signed in").toBe("");
    await signed.close();
  });
});

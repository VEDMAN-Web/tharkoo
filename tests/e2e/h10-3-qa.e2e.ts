import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

const SHOTS = process.env.H103_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}

/** H10.3: the 404 tab title stays, and the sign-in and sign-up addresses people guess lead to the right page. */

test.describe("H10.3 404 title and redirects", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`a missing page keeps the tab title Page not found | Tharkoo after it loads, at ${size.width}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(size);
      for (const path of ["/nope-404/", "/does-not-exist/", "/dating/nope-zzz/"]) {
        const response = await page.goto(path, { waitUntil: "networkidle" });
        expect(response?.status(), path).toBe(404);
        await page.waitForTimeout(2500);
        await expect(page, path).toHaveTitle("Page not found | Tharkoo");
        if (path === "/nope-404/") await shot(page, "not-found");
        await expect(page.locator("h1")).toHaveCount(1);
      }
    });
  }

  test("/login/ goes to /u/login/, and /signup/ and /register/ go to the sign-up page, with a 308 and the query string kept", async ({ request }) => {
    const cases: [string, string][] = [
      ["/login/", "/u/login/"],
      ["/login/?next=%2Fu%2Faccount%2F&ref=abc", "/u/login/?next=%2Fu%2Faccount%2F&ref=abc"],
      ["/signup/", "/u/register/"],
      ["/signup/?ref=abc", "/u/register/?ref=abc"],
      ["/register/", "/u/register/"],
      ["/register/?next=%2Fu%2Faccount%2F", "/u/register/?next=%2Fu%2Faccount%2F"],
    ];
    for (const [from, to] of cases) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      const location = new URL(response.headers().location, "http://example.test");
      expect(location.pathname + location.search, from).toBe(to);
    }
  });

  test("an audit row that carries a raw date reads as a plain Indian-time date, at 1440 and 390, axe 0", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await withLocalDb((db) =>
      db.collection("audit_events").insertOne({ actorType: "admin", actorRole: "moderator", action: "listing.extend", summary: "Extended, ends 2026-11-19T06:22:12.469Z: Honda Activa", targetType: "listing", targetId: "ad-h103", targetLabel: "Honda Activa", requestId: "e2e", createdAt: new Date(Date.now() - 60_000) }),
    );
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/history/?tab=audit&days=7");
      const table = page.locator('[data-tk="server-table"]');
      await expect(table).toContainText(/Extended, ends 19 Nov( 2026)?, 11:52 am: Honda Activa/);
      await expect(table).not.toContainText("2026-11-19T06:22");
      expect(await hasHorizontalScroll(page)).toBe(false);
      const serious = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
      expect(serious.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
      await table.getByText(/Extended, ends 19 Nov/).first().scrollIntoViewIfNeeded();
      await shot(page, "audit-plain-date");
    }
  });

  test("the guessed sign-in address ends on the sign-in page", async ({ page }) => {
    await page.goto("/login/?next=%2Fu%2Faccount%2F", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/u\/login\/\?next=/);
    await expect(page.locator("h1").first()).toBeVisible();
  });
});

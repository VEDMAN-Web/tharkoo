import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, setRoles, signInAdminContext, test, uniqueEmail, withLocalDb } from "./helpers";

const SHOTS = process.env.A7_SHOTS_DIR || "";
const SIZES = [
  [1440, 900],
  [390, 844],
] as const;

async function shots(page: Page, name: string, path: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.goto(path);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}x${height}.png` });
  }
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("A7 admin shell", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("a new report shows in the sidebar number and the bell without a reload", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/");
    await expect(page.locator(".adm-nav")).toBeVisible();
    const badge = page.locator('[data-tk="count-reports"]');
    const before = (await badge.count()) ? Number((await badge.innerText()).replace(/\D/g, "")) : 0;
    const added = await withLocalDb((db) => db.collection("reports").insertOne({ listingId: new ObjectId(), reason: "spam", severity: "S3", status: "open", createdAt: new Date(), updatedAt: new Date() }));
    test.skip(!added, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.dispatchEvent(new Event("focus")));
          await page.waitForTimeout(1500);
          return (await badge.count()) ? Number((await badge.innerText()).replace(/\D/g, "")) : 0;
        },
        { timeout: 60_000, intervals: [2_000] },
      )
      .toBe(before + 1);
    await expect(page.locator('[data-tk="bell"]')).toHaveAttribute("aria-label", /^Notifications, /);
  });

  test("the counts route is for staff only, never cached, and hides what the role cannot see", async ({ page, baseURL }) => {
    const email = uniqueEmail("a7count");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    const promoted = await setRoles(email, ["support"]);
    test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    const anonymous = await page.request.get("/api/admin/counts");
    expect(anonymous.status()).toBe(403);
    await loginUi(page, email, undefined, "/admin/");
    const res = await page.request.get("/api/admin/counts");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const counts = (await res.json()).data.counts as Record<string, number>;
    expect(Object.keys(counts)).toEqual(["tickets"]);
  });

  test("a staff screen the role does not open gives a styled 403 with one H1, noindex and a way back", async ({ page, baseURL }) => {
    const email = uniqueEmail("a7mod");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    const promoted = await setRoles(email, ["moderator"]);
    test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    await loginUi(page, email, undefined, "/admin/");
    const response = await page.goto("/admin/prices/");
    expect(response?.status()).toBe(403);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("You cannot open Prices & plans");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator(".who")).toHaveText("Admin, Superadmin, Finance");
    expect(await serious(page)).toEqual([]);
    await shots(page, "403", "/admin/prices/");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/prices/");
    await page.getByRole("link", { name: "Back to Dashboard" }).click();
    await expect(page).toHaveURL(/\/admin\/$/);
    await expect(page.locator(".adm-nav")).toBeVisible();
  });

  test("the staff sign-in page is styled, has one H1, passes axe and fits a phone", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/login/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Staff sign in");
    await expect(page.locator(".adm-login-card")).toBeVisible();
    for (const field of ["#email", "#password"]) {
      const box = (await page.locator(field).boundingBox())!;
      expect(box.height, field).toBeGreaterThanOrEqual(44);
    }
    expect((await page.getByRole("button", { name: "Sign in" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await page.locator("#email").fill("nobody@example.test");
    await page.locator("#password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator('[data-tk="login-error"]')).not.toBeEmpty();
    await shots(page, "signin", "/admin/login/");
    expect(baseURL).toBeTruthy();
  });

  test("the shell has the pink sidebar and top bar at 1440 and a bottom bar of five on a phone", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator(".adm-link.is-active")).toHaveText(/Dashboard/);
    const active = await page.locator(".adm-link.is-active").evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(active).toBe("rgb(253, 236, 243)");
    await expect(page.locator(".adm-side")).toBeVisible();
    await expect(page.locator('[data-tk="bottom-bar"]')).toBeHidden();
    await page.keyboard.press("/");
    await expect(page.locator(".adm-search input")).toBeFocused();
    expect(await serious(page)).toEqual([]);
    await shots(page, "shell", "/admin/");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/");
    const bar = page.locator('[data-tk="bottom-bar"]');
    await expect(bar).toBeVisible();
    await expect(bar.locator("a, button")).toHaveText([/^Today$/, /^Review\d*$/, /^Support\d*$/, /^Search$/, /^More$/]);
    for (const item of await bar.locator("a, button").all()) expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await bar.getByRole("button", { name: "More" }).click();
    await expect(page.locator("#adm-sheet")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  });
});

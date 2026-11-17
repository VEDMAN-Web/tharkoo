import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, setRoles, signInAdminContext, test, uniqueEmail, withLocalDb } from "./helpers";

const SHOTS = process.env.A49_SHOTS_DIR || "";

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

async function staffPage(page: Page, baseURL: string, role: string) {
  const email = uniqueEmail(`a49${role}`);
  const api = await newApi(baseURL);
  await registerApi(api, baseURL, email);
  await api.dispose();
  const promoted = await setRoles(email, [role]);
  if (!promoted) return false;
  await loginUi(page, email, undefined, "/admin/");
  return true;
}

async function openSearch(page: Page) {
  const input = page.getByPlaceholder("Find an ad, user, page");
  await expect(async () => {
    await page.keyboard.press("/");
    await expect(input).toBeFocused({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  return input;
}

test.describe("A49 admin global search", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("the / key opens it, results are grouped, arrows and Enter open a row, Esc closes, axe 0", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/");
    await page.keyboard.press("/");
    const input = page.getByPlaceholder("Find an ad, user, page");
    await expect(input).toBeFocused();
    await input.fill("tutoring");
    const panel = page.locator('[data-tk="search-panel"]');
    await expect(panel.locator('[data-tk="search-group-ads"]')).toBeVisible();
    await expect(panel.locator('[data-tk="search-result"]').first()).toBeVisible();
    expect(await serious(page)).toEqual([]);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/search-1440x900.png` });
    }
    await input.fill("users");
    await expect(panel.locator('[data-tk="search-group-screens"]')).toContainText("Users");
    await input.fill("zzzzqqq");
    await expect(panel.locator('[data-tk="search-empty"]')).toContainText("Nothing found");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(input).toHaveValue("");

    await page.keyboard.press("/");
    await input.fill("tutoring");
    await expect(panel.locator('[data-tk="search-result"]').first()).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(panel.locator(".is-on")).toHaveCount(1);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/ads\/[a-f0-9]{24}\/$/);
  });

  test("on a phone the Search button opens the field and the results fit", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/");
    await page.getByRole("button", { name: "Search" }).first().click();
    const input = page.getByPlaceholder("Find an ad, user, page");
    await expect(input).toBeFocused();
    await input.fill("tutoring");
    const panel = page.locator('[data-tk="search-panel"]');
    await expect(panel.locator('[data-tk="search-result"]').first()).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect((await panel.locator('[data-tk="search-result"]').first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/search-390x844.png` });
  });

  test("support does not see finance-only rows, finance does", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ref = `pay_E2E49_${Date.now()}`;
    await withLocalDb((db) => db.collection("payments").insertOne({ userId: new ObjectId(), orderId: new ObjectId(), idempotencyKey: `k-${ref}`, provider: "razorpay", providerRef: ref, amount: 500, currency: "INR", status: "paid", createdAt: new Date(), updatedAt: new Date() }));
    await page.setViewportSize({ width: 1440, height: 900 });
    const asSupport = await staffPage(page, baseURL!, "support");
    test.skip(!asSupport, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    const input = await openSearch(page);
    await input.fill(ref);
    await expect(page.locator('[data-tk="search-empty"]')).toBeVisible();
    await expect(page.locator('[data-tk="search-group-orders"]')).toHaveCount(0);
    const direct = await page.request.get(`/api/admin/search?q=${encodeURIComponent(ref)}`);
    expect(direct.status()).toBe(200);
    expect(await direct.text()).not.toContain(ref);
    await page.context().clearCookies();

    await staffPage(page, baseURL!, "finance");
    const financeInput = await openSearch(page);
    await financeInput.fill(ref);
    await expect(page.locator('[data-tk="search-group-orders"]')).toContainText(ref);
  });
});

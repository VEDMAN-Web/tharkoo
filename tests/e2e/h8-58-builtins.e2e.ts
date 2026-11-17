import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H8.58: the Content studio lists the built-in blog posts and help topics, and staff can edit and remove them. */

const SHOTS = process.env.H858_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("H8.58 built-in blog posts and help topics", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("both tabs list what the site shows today; clean at 1440 and 390", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      for (const tab of ["blog", "help"]) {
        await page.goto(`/admin/content/${tab === "help" ? "?tab=help" : ""}`);
        const list = page.locator('[data-tk="built-in-list"]');
        await expect(list).toBeVisible();
        await expect(list.getByRole("heading", { name: "Built in, live on the site now" })).toBeVisible();
        expect(await list.locator('[data-tk="built-in-row"]').count()).toBeGreaterThanOrEqual(1);
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await serious(page)).toEqual([]);
        await shot(page, `studio-${tab}`);
      }
    }
  });

  test("open a built-in post, change its title, then remove it", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/content/");
    const row = page.locator('[data-tk="built-in-row"]').last();
    const before = (await row.locator("strong").innerText()).trim();
    await row.click();
    await expect(page).toHaveURL(/\/admin\/blog-posts\/\?open=/);
    const drawer = page.locator('[data-tk="record-drawer"]');
    await expect(drawer).toBeVisible();
    const stamp = String(Date.now() % 100000);
    await drawer.getByLabel(/^Title/).fill(`${before} ${stamp}`);
    await page.getByRole("button", { name: "Save post" }).click();
    await expect(page.getByText(`Saved ${before} ${stamp}.`)).toBeVisible();
    await shot(page, "blog-posts-edit");
    await page.goto("/admin/content/");
    await expect(page.locator('[data-tk="built-in-row"]', { hasText: `${before} ${stamp}` })).toBeVisible();
    await page.locator('[data-tk="built-in-row"]', { hasText: `${before} ${stamp}` }).click();
    await page.getByRole("button", { name: "Delete post..." }).click();
    await page.locator('[data-tk="reason-dialog"]').getByRole("button", { name: "Delete post" }).click();
    await expect(page.getByText(`Deleted ${before} ${stamp}.`)).toBeVisible();
    await page.goto("/admin/content/");
    await expect(page.locator('[data-tk="built-in-row"]', { hasText: `${before} ${stamp}` })).toHaveCount(0);
  });

  test("a built-in help topic opens in its own screen and can be set to draft", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/content/?tab=help");
    await page.locator('[data-tk="built-in-row"]').first().click();
    await expect(page).toHaveURL(/\/admin\/help-topics\/\?open=/);
    const drawer = page.locator('[data-tk="record-drawer"]');
    await expect(drawer).toBeVisible();
    await drawer.getByLabel("Status").selectOption("draft");
    await page.getByRole("button", { name: "Save article" }).click();
    await expect(page.getByText(/^Saved /)).toBeVisible();
  });
});

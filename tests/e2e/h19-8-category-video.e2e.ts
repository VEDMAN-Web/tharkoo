import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H19.8: the Video calls section of the category form and the New category dialog. Set SHOTS_DIR to save screenshots. */

const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: `${shotsDir}/${name}-${page.viewportSize()?.width ?? 0}.png`, fullPage: true });
}

test.describe("H19.8 video calls in the category form", () => {
  test("the form shows the section with the share line, refuses a price under 10, saves 25 and the Video tours page shows the same", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/categories/?c=jobs");
    const section = page.locator('[data-tk="video-calls"]');
    await expect(section).toBeVisible();
    await expect(section.locator('[data-tk="video-share-line"]')).toHaveText("Users pay this per call. The vendor keeps 70 %, Tharkoo keeps 30 %.");
    const price = section.getByLabel("Price per call (credits)");
    await price.fill("9");
    await expect(section.getByRole("alert")).toContainText("from 10 to 100");
    await section.getByRole("switch").click();
    await price.fill("25");
    await page.getByRole("button", { name: "Save video calls" }).click();
    await expect(page.locator('[data-tk="video-message"]')).toHaveText("Video calls saved.");
    await shot(page, "category-form");
    expect(await hasHorizontalScroll(page)).toBe(false);
    await page.goto("/admin/settings/video-tours/");
    const input = page.getByLabel("Credit price for Jobs");
    await expect(input).toHaveValue("25");
  });

  test("a people category shows the switch off with the reason", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/categories/?c=dating");
    const section = page.locator('[data-tk="video-calls"]');
    await expect(section.getByRole("switch")).toBeDisabled();
    await expect(section.locator('[data-tk="video-lock"]')).toContainText("never allowed");
  });

  test("the New category dialog has the Video calls section", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/categories/");
    await page.getByRole("button", { name: /New category/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('[data-tk="video-calls"]')).toBeVisible();
    await expect(dialog.locator('[data-tk="video-share-line"]')).toContainText("The vendor keeps");
    await shot(page, "new-category");
  });
});

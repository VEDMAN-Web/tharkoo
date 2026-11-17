import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H8.47 (A47): the Site text screen. */

const SHOTS = process.env.A47_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

test.describe("A47 site text", () => {
  test("every field has a plain name, a text can be changed and undone, and search finds words across areas", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/ui-text/");
    await expect(page.locator("h1")).toHaveText("Site text");
    await expect(page.getByRole("link", { name: "Menus and footer" })).toHaveAttribute("href", "/admin/menus/");
    await shot(page, "site-text");

    for (const area of ["Home page", "Listing pages", "Post your ad", "Credits and payments"]) {
      await page.getByRole("tab", { name: new RegExp(`^${area}`) }).click();
      const labels = await page.locator('[data-tk="text-row"] label').allInnerTexts();
      expect(labels.length, area).toBeGreaterThan(3);
      for (const label of labels) expect(label, `${area}: ${label}`).not.toMatch(/^[a-z]+\.[a-zA-Z]/);
    }

    await page.getByRole("tab", { name: /^Home page/ }).click();
    const box = page.getByLabel("Search all states", { exact: true });
    const before = await box.inputValue();
    await box.fill("Pick a state");
    await expect(page.getByText("1 unsaved change")).toBeVisible();
    await shot(page, "site-text-edit");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved 1 text.")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(/Undone\. 1 text is back as before/)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /^Home page/ }).click();
    await expect(page.getByLabel("Search all states", { exact: true })).toHaveValue(before);

    await page.getByRole("searchbox", { name: "Search the site text" }).fill("alerts");
    await expect(page.locator("[data-area]")).not.toHaveCount(0);
    await expect(page.locator('[data-tk="text-row"]').first()).toBeVisible();
    await page.getByRole("searchbox", { name: "Search the site text" }).fill("zzzz-no-such-text");
    await expect(page.locator('[data-tk="site-text-empty"]')).toBeVisible();
  });

  test("it fits 390, 768 and 1440 with no sideways scroll and passes axe", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/ui-text/");
      await expect(page.locator("h1")).toHaveText("Site text");
      expect(await hasHorizontalScroll(page), `${size.width}`).toBe(false);
      await shot(page, "site-text-fit");
      const found = await new AxeBuilder({ page }).include('[data-tk="site-text"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`), `${size.width}`).toEqual([]);
    }
  });
});

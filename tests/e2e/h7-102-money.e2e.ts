import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

const SHOTS = process.env.MONEY_SHOTS_DIR || "";
const BANNER = "Test payments are ON: anyone can add credits without paying. Turn OFF before launch.";
const FREE_CLAIM = /post free|free to post|posting is free|free classifieds|post(?:ing)? (?:your ad )?for free|post a free ad/i;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test.describe("H7.102 money settings and wording", () => {
  test("an admin sees the test payments banner, sets the fee and price, and turns mock payments off and on", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin screens are for wide screens");
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1536, height: 674 });
    await page.goto("/admin/settings/money/");
    const section = page.locator('[data-tk="money-settings"]');
    await expect(section).toBeVisible();
    await expect(page.locator('[data-tk="mock-payments-banner"]')).toHaveText(BANNER);
    await expect(section.getByLabel("Ad posting fee (credits)")).toHaveValue("30");
    await expect(section.getByRole("switch", { name: "Paid posting: On" })).toHaveAttribute("aria-checked", "false");
    await expect(section.getByLabel("Credit price (Rs)")).toHaveValue("10");
    await shot(page, "money-settings-1536x674");

    await section.getByLabel("Ad posting fee (credits)").fill("40");
    await section.getByRole("button", { name: "Save" }).click();
    await expect(section.getByText("Saved.")).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-tk="money-settings"]').getByLabel("Ad posting fee (credits)")).toHaveValue("40");

    await page.locator('[data-tk="money-settings"]').getByRole("switch", { name: "Mock payments: On" }).click();
    await expect(page.getByText("Saved. Test payments are off.")).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-tk="mock-payments-banner"]')).toHaveCount(0);
    await page.locator('[data-tk="money-settings"]').getByRole("switch", { name: "Mock payments: On" }).click();
    await expect(page.getByText("Saved. Test payments are on.")).toBeVisible();
    await page.locator('[data-tk="money-settings"]').getByLabel("Ad posting fee (credits)").fill("30");
    await page.locator('[data-tk="money-settings"]').getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    await page.goto("/admin/");
    await expect(page.locator('[data-tk="mock-payments-banner"]')).toHaveText(BANNER);
  });

  test("the header and footer no longer say free, and the public pages make no free-posting claim", async ({ page }) => {
    for (const [width, height] of [
      [1536, 674],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(page.locator("header").first()).not.toContainText(/free/i);
      const footer = page.locator('footer[data-tk="footer"]');
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).not.toContainText(FREE_CLAIM);
      await expect(footer).not.toContainText(/FREE CLASSIFIEDS/i);
      await shot(page, `footer-${width}x${height}`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `header-${width}x${height}`);
      expect(await hasHorizontalScroll(page)).toBe(false);
    }
    for (const path of ["/categories/", "/how-it-works/", "/help/", "/cities/"]) {
      await page.goto(path);
      await expect(page.locator("main")).not.toContainText(FREE_CLAIM);
    }
  });
});

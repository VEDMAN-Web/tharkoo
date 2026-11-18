import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test } from "./helpers";

/** H9.6b: the inside of the Coupons page: sentence case, a plain label and placeholder, the help-page accordion, no invented support hours. */

const SHOTS = process.env.H96B_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

test.describe("H9.6b Coupons page", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("sentence case, Have a coupon? with a Coupon code box and Apply, the help accordion, no ticket icon and no invented support hours; clean at 1440 and 390", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "h96bcoupon");
    await api.dispose();
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await loginUi(page, email, undefined, "/u/account/coupons/");
      await page.goto("/u/account/coupons/");
      const panel = page.locator("section.up-panel").first();
      await expect(panel.getByRole("heading", { level: 1, name: "Coupons" })).toBeVisible();
      await expect(panel.getByText("Have a coupon?", { exact: true })).toBeVisible();
      const input = panel.getByLabel("Have a coupon?");
      await expect(input).toHaveAttribute("placeholder", "Coupon code");
      await expect(panel.locator("form svg")).toHaveCount(0);
      const apply = panel.getByRole("button", { name: "Apply", exact: true });
      await expect(apply).toBeVisible();
      const text = await panel.innerText();
      expect(text).not.toMatch(/APPLY|CONTACT US|Insert coupon code|Do you have a Coupon/);
      await expect(panel.getByRole("link", { name: "Contact us", exact: true })).toBeVisible();
      expect(text).not.toMatch(/excluding holidays|Monday through Friday/);
      const faq = panel.locator("button[aria-controls^='faq-panel-']");
      expect(await faq.count()).toBeGreaterThanOrEqual(2);
      await expect(faq.first()).toHaveAttribute("aria-expanded", "true");
      await faq.nth(1).click();
      await expect(faq.nth(1)).toHaveAttribute("aria-expanded", "true");
      await input.fill("NO-SUCH-COUPON");
      await apply.click();
      await expect(panel.locator("[aria-live=polite]")).not.toHaveText("");
      expect(await hasHorizontalScroll(page)).toBe(false);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
      await shot(page, "coupons");
    }
  });
});

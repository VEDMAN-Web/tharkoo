import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H7.170b: the Search engines block stacks (badge, text at full width, button) and the logo info markers carry a visible label. */

const SHOTS = process.env.H7170B_SHOTS_DIR ?? "";

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

test.describe("H7.170b Settings stack", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("Search engines: badge, then the text at full width, then Open SEO; the logo info markers have a visible label; clean at 1440 and 390", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/settings/");
      const stack = page.locator('[data-tk="search-stack"]');
      const badge = await stack.locator(".adm-k-badge, [class*='badge']").first().boundingBox();
      const text = await stack.locator("p").boundingBox();
      const link = await stack.getByRole("link", { name: "Open SEO" }).boundingBox();
      const body = await stack.boundingBox();
      expect(badge!.y + badge!.height).toBeLessThanOrEqual(text!.y + 1);
      expect(text!.y + text!.height).toBeLessThanOrEqual(link!.y + 1);
      expect(text!.width).toBeGreaterThanOrEqual(body!.width - 48);

      const logo = page.locator('[data-tk="logo-settings"]');
      await expect(logo.getByText("Size and format", { exact: true })).toHaveCount(2);
      const info = logo.getByRole("button", { name: "Size and format: Logo (light backgrounds)" });
      await expect(info).toBeVisible();
      await info.click();
      await expect(logo.getByText("Up to 8 MB.").first()).toBeVisible();
      await page.keyboard.press("Escape");
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "settings");
    }
  });
});

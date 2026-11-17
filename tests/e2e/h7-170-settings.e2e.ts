import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H7.170: Settings in one style, Logo as its own section, the raw site record behind an Advanced switch, video tours as a short list. */

const SHOTS = process.env.H7170_SHOTS_DIR ?? "";

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

test.describe("H7.170 Settings", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("Logo is its own section, every setting uses one style, the links are a short list, and the raw record is behind Advanced; clean at 1440 and 390", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/settings/");
      const nav = page.locator('[data-tk="settings-nav"]');
      for (const label of ["Logo", "Advanced"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Raw site record" })).toHaveCount(0);

      const logo = page.locator('[data-tk="logo-settings"]');
      await expect(logo.getByRole("heading", { level: 2, name: "Logo" })).toBeVisible();
      await expect(logo).toContainText("Logo (light backgrounds)");
      await expect(logo).toContainText("Logo (dark backgrounds)");
      await expect(page.locator("#photos")).not.toContainText("Logo");

      expect(await page.locator(".adm-s-main").locator("h2.t-h3, .adm-input, button.adm-btn:not(.adm-btn-ghost), a.adm-btn").evaluateAll((nodes) => nodes.map((node) => `${node.tagName}.${node.className}`))).toEqual([]);
      expect(await page.locator(".adm-s-item .adm-s-item-h").count()).toBeGreaterThanOrEqual(5);

      const links = page.locator('[data-tk="settings-links"]');
      await expect(links.locator("li")).toHaveCount(4);
      await expect(links.getByRole("link", { name: "Live video tours" })).toHaveAttribute("href", "/admin/settings/video-tours/");

      const raw = page.locator('[data-tk="raw-site"]');
      await expect(raw.getByRole("heading", { level: 2, name: "Advanced" })).toBeVisible();
      await expect(raw.locator("pre")).toHaveCount(0);
      expect(await page.content()).not.toContain('&quot;key&quot;: &quot;default&quot;');
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await raw.getByRole("switch", { name: "Show the raw site record" }).click();
      await expect(raw.locator("pre")).toContainText('"key": "default"');
      await raw.getByRole("switch", { name: "Show the raw site record" }).click();
      await expect(raw.locator("pre")).toHaveCount(0);
      await shot(page, "settings");
    }
  });
});

import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H8.59: on a phone the Test payments bar is one line and the Page builder save bar is one short row that leaves the blocks readable. */

const SHOTS = process.env.H859_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-390x844.png` });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("H8.59 phone bars", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("the Test payments bar is one line on a phone and keeps its full words on a laptop", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const bar = page.locator('[data-tk="mock-payments-banner"]');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("Test payments are ON");
    await expect(bar.getByRole("link", { name: "Turn off" })).toBeVisible();
    const box = await bar.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(48);
    const link = await bar.getByRole("link").boundingBox();
    expect(link!.height).toBeGreaterThanOrEqual(44);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "test-payments-bar");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(bar).toContainText("anyone can add credits without paying");
    await expect(bar.getByRole("link", { name: "Turn off in Prices & plans" })).toBeVisible();
  });

  test("the Page builder save bar is one short row above the bottom menu, with all three actions reachable", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of ["", "?tab=post"]) {
      await page.goto(`/admin/page-builder/${tab}`);
      const bar = page.getByRole("region", { name: "Save changes" });
      await expect(bar).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 700));
      await expect(bar.getByRole("button", { name: "Publish" })).toBeVisible();
      await expect(bar.getByRole("button", { name: "Save draft" })).toBeVisible();
      const box = await bar.boundingBox();
      expect(box!.height).toBeLessThanOrEqual(64);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844 - 60);
      for (const button of await bar.getByRole("button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, `page-builder-save-bar${tab ? "-post" : ""}`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const last = page.locator("section.adm-card").last();
      const lastBox = await last.boundingBox();
      const barBox = await bar.boundingBox();
      expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(barBox!.y + 1);
    }
  });
});

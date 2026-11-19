import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";

/**
 * H15.9 (E1-A7, E1-A3, E1-A4): the report page uses the site's own look, a saved ad's place line reads cleanly, and /scam-report/ is a
 * short help page that says what to do.
 */

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("H15.9 report page, saved card, scam-report", () => {
  test("E1-A7: the report page has the site's fonts and layout: label above each field, full-width fields, a real button", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/submit-report/?ad=demo-0352");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const font = await page.getByRole("heading", { level: 1 }).evaluate((node) => getComputedStyle(node).fontFamily);
    expect(font, "the heading uses the site's sans font, not the old serif").not.toMatch(/Cormorant|Georgia|Times/i);
    const form = page.getByRole("form", { name: "Report this ad" });
    const formBox = (await form.boundingBox())!;
    const select = form.locator("select");
    const area = form.locator("textarea");
    for (const [name, field] of [["reason", select], ["details", area]] as const) {
      const box = (await field.boundingBox())!;
      expect(box.width, `${name} field fills the form`).toBeGreaterThanOrEqual(formBox.width * 0.9);
      expect(box.height, `${name} field is a real control`).toBeGreaterThanOrEqual(40);
    }
    // Each label sits above its field, not beside it.
    for (const [label, field] of [[form.getByText("Why are you reporting this ad?"), select], [form.getByText("More details (optional)"), area]] as const) {
      const l = (await label.boundingBox())!;
      const f = (await field.boundingBox())!;
      expect(l.y + l.height, "label above its field").toBeLessThanOrEqual(f.y + 2);
    }
    const button = form.getByRole("button", { name: "Send report" });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
  });

  test("E1-A3: a saved ad's place line has no leading slash and no empty line", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dating/bengaluru/");
    await page.waitForLoadState("networkidle");
    await page.locator('[data-tk="listing-row"]').first().locator(".tk-row-save").click();
    await page.goto("/u/account/saved/");
    await page.waitForLoadState("networkidle");
    const card = page.locator('[data-tk="card"]').first();
    await expect(card).toBeVisible();
    const lines = (await card.locator(".tk-card-meta p").allInnerTexts()).map((line) => line.trim());
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, "no empty meta line").not.toBe("");
      expect(line, "no leading slash").not.toMatch(/^\//);
    }
    expect(lines.join(" | ")).toMatch(/Bengaluru/);
  });

  test("E1-A4: /scam-report/ is a short help page: what to do, in the Help article style", async ({ page }) => {
    test.setTimeout(120_000);
    const response = await page.goto("/scam-report/");
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/scam/i);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Help" })).toBeVisible();
    const text = (await page.locator("article").innerText()).toLowerCase();
    expect(text.length, "a real page, not one sentence").toBeGreaterThan(400);
    for (const word of ["deposit", "video call", "report this ad", "support"]) expect(text, `says something about ${word}`).toContain(word);
    await expect(page.locator("article").getByRole("link", { name: /support|contact/i }).first()).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
  });
});

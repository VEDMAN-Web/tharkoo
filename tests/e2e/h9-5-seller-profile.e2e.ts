import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test } from "./helpers";

/** H9.5: the seller profile page sits in the account panel, has one heading, no preselected city, switches with one benefit line each, and Save and continue. */

const SHOTS = process.env.H95_SHOTS_DIR ?? "";

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

test.describe("H9.5 Seller profile", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("the page is in the account panel with one 20 px heading, no eyebrow, no preselected city, switches with a benefit line each, and Save and continue (1440 and 390)", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const { email } = await newUserApi(baseURL!, "h95form");
    await loginUi(page, email, undefined, "/u/seller-profile/?next=/u/account/");
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/u/seller-profile/?next=/u/account/");
      const form = page.locator('[data-tk="seller-profile"]');
      await expect(form).toBeVisible();
      await expect(page.getByRole("navigation", { name: "My account" })).toBeVisible();
      // One heading, at the same size and weight as the other account pages.
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      const h1 = page.getByRole("heading", { level: 1, name: "About you" });
      await expect(h1).toBeVisible();
      const look = await h1.evaluate((node) => ({ size: getComputedStyle(node).fontSize, weight: getComputedStyle(node).fontWeight }));
      expect(look).toEqual({ size: "20px", weight: "800" });
      await expect(form.getByText("About you", { exact: true })).toHaveCount(1);
      await expect(page.locator(".tk-sp-eyebrow")).toHaveCount(0);
      // No city is chosen for the person.
      const city = form.locator("select[name=city]");
      await expect(city).toHaveValue("");
      await expect(city.locator("option:checked")).toHaveText("Choose your city");
      // Switches: a benefit line each, no question, big enough to tap.
      const switches = form.getByRole("switch");
      await expect(switches).toHaveCount(2);
      await expect(form.getByText("Turn on live chat?")).toHaveCount(0);
      await expect(form.getByText("People see Online now on your ads.")).toBeVisible();
      await expect(form.getByText("People can chat with you on Tharkoo. Your ads show Online now or Away.")).toBeVisible();
      const boxes = form.locator("input[type=checkbox]");
      expect(await boxes.count()).toBeGreaterThanOrEqual(3);
      for (let index = 0; index < (await boxes.count()); index += 1) {
        const box = await boxes.nth(index).boundingBox();
        expect(box?.width ?? 0, `checkbox ${index} width`).toBeGreaterThanOrEqual(24);
        expect(box?.height ?? 0, `checkbox ${index} height`).toBeGreaterThanOrEqual(24);
        expect(await boxes.nth(index).evaluate((node) => Boolean(node.closest(".up-check"))), `checkbox ${index} uses .up-check`).toBe(true);
      }
      const small = await form.locator(".tk-sp-switch-text small").evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
      expect(Math.min(...small)).toBeGreaterThanOrEqual(12);
      // One primary button.
      const save = form.getByRole("button", { name: "Save and continue", exact: true });
      await expect(save).toBeVisible();
      expect((await save.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(24);
      await expect(form.getByRole("button")).toHaveCount(1);
      // No words a visitor should not see.
      expect(await page.locator(".up-main").innerText()).not.toMatch(/\b(seller|vendor|buyer)s?\b/i);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "seller-profile");
    }
  });

  test("an empty city is asked for in plain words, and saving with a city goes on to the next page", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const { email } = await newUserApi(baseURL!, "h95save");
    await loginUi(page, email, undefined, "/u/seller-profile/?next=/u/account/");
    await page.setViewportSize({ width: 1440, height: 900 });
    const form = page.locator('[data-tk="seller-profile"]');
    await form.locator("input[name=name]").fill("Asha");
    await form.locator("input[name=dateOfBirth]").fill("1990-01-01");
    await form.getByRole("checkbox", { name: /I am 18 or older/ }).check();
    await form.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.locator("#tk-sp-city-err, .tk-sp-error").first()).not.toHaveText("");
    await expect(page).toHaveURL(/\/u\/seller-profile\//);
    await form.locator("select[name=city]").selectOption({ label: "Mumbai" });
    await form.getByRole("switch", { name: /Live chat/ }).check();
    await form.getByRole("button", { name: "Save and continue" }).click();
    await page.waitForURL((url) => url.pathname === "/u/account/");
    await page.goto("/u/seller-profile/");
    await expect(page.locator("select[name=city]")).toHaveValue("Mumbai");
    await expect(page.getByRole("switch", { name: /Live chat/ })).toBeChecked();
    await expect(page.locator('[data-tk="seller-profile"]').locator("input[name=dateOfBirth]")).toHaveCount(0);
  });
});

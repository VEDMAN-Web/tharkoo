import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test } from "./helpers";

/** H9.1: one way to buy credits, the same picker on the Account home, the credits page, the Wallet and the posting sheet. */

const SHOTS = process.env.H91_SHOTS_DIR ?? "";

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

async function checkPicker(page: Page) {
  const picker = page.locator('[data-tk="credit-packs"]');
  await expect(picker).toBeVisible();
  const packs = picker.locator('[data-tk="recharge-pack"]');
  const count = await packs.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(4);
  await expect(picker.locator('[aria-checked="true"][data-tk="recharge-pack"]')).toHaveCount(1);
  await expect(picker.getByText("Most popular", { exact: true })).toHaveCount(1);
  await expect(picker.locator('[data-tk="recharge-pack"][aria-checked="true"]').getByText("Most popular", { exact: true })).toBeVisible();
  await expect(picker.locator('[data-tk="recharge-pay"]')).toHaveText(/^Pay ₹[0-9,]+$/);
  await expect(picker.locator('[data-tk="recharge-pay"]')).toBeEnabled();
  await expect(picker.locator('[data-tk="packs-purpose"]')).toHaveText("Credits pay for posting and promoting ads.");
  await expect(picker.locator('[data-tk="packs-test"]')).toBeVisible();
  // The "Enough for ..." line shows only while posting costs credits (H11.1b). Another spec can switch paid posting on at the same time
  // (two workers share one database), so read what the server says now instead of assuming posting is free.
  const paidOn = await page.evaluate(async () => (await (await fetch("/api/payments/packs")).json())?.data?.prices?.paidPostingOn === true);
  if (paidOn) await expect(picker.locator('[data-tk="pack-ads"]').first()).toContainText("Enough for");
  else await expect(picker.locator('[data-tk="pack-ads"]')).toHaveCount(0);
  const text = await picker.innerText();
  expect(text).not.toMatch(/Extra credits|Best deal|Choose a pack|\.00/);
  expect(text).toMatch(/\+\d+ free/);
  return picker;
}

test.describe("H9.1 credit packs", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("the credits page shows the packs inline, at most four first, one Most popular pre-selected, a Pay button and one plain line; See all packs shows the rest", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "h91credits");
    await api.dispose();
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await loginUi(page, email, undefined, "/u/account/credits/");
      await page.goto("/u/account/credits/");
      await expect(page.getByRole("heading", { level: 1, name: "Buy credits" })).toBeVisible();
      await expect(page.locator('[data-tk="open-recharge"]')).toHaveCount(0);
      const picker = await checkPicker(page);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      for (const button of await picker.getByRole("button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(24);
      await shot(page, "credits");
      const first = await picker.locator('[data-tk="recharge-pack"]').count();
      const more = picker.locator('[data-tk="see-all-packs"]');
      if (await more.count()) {
        await more.click();
        expect(await picker.locator('[data-tk="recharge-pack"]').count()).toBeGreaterThan(first);
        await expect(more).toHaveText("Show fewer packs");
        await more.click();
        expect(await picker.locator('[data-tk="recharge-pack"]').count()).toBe(first);
      }
    }
  });

  test("the Account home and the Wallet show the same picker; the Wallet sits in the account panel with the normal heading and no Earnings tab without earnings", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "h91wallet");
    await api.dispose();
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginUi(page, email, undefined, "/u/account/");
    await page.goto("/u/account/");
    await checkPicker(page);
    await shot(page, "home");
    await page.goto("/u/account/wallet/");
    await checkPicker(page);
    await expect(page.getByRole("navigation", { name: "My account" })).toBeVisible();
    const heading = page.getByRole("heading", { level: 1, name: "Wallet" });
    await expect(heading).toBeVisible();
    const fonts = await page.evaluate(() => [document.querySelector("h1")!, document.querySelector("#buy-heading, .up-h2")!].map((el) => getComputedStyle(el).fontFamily));
    expect(fonts[0]).toMatch(/Plus Jakarta Sans/);
    await expect(page.getByRole("button", { name: "Earnings" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Buy credits" })).toHaveAttribute("aria-pressed", "true");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await shot(page, "wallet");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/u/account/");
    await checkPicker(page);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "home");
    await page.goto("/u/account/wallet/");
    await checkPicker(page);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "wallet");
  });

  test("the posting-flow sheet uses the same picker, with the same Pay button and plain line", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "h91sheet");
    await api.dispose();
    await page.setViewportSize({ width: 390, height: 844 });
    await loginUi(page, email, undefined, "/u/account/credits/");
    const sheet = page.locator('[data-tk="recharge-sheet"]');
    await expect(async () => {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("tk-recharge-open", { detail: { shortfall: 300 } })));
      await expect(sheet).toBeVisible({ timeout: 1500 });
    }).toPass();
    await expect(sheet.locator('[data-tk="credit-packs"]')).toBeVisible();
    await expect(sheet.locator('[data-tk="recharge-short"]')).toContainText("You need 300 more credits");
    await expect(sheet.locator('[data-tk="packs-purpose"]')).toBeVisible();
    await expect(sheet.locator('[data-tk="recharge-pay"]')).toHaveText(/^Pay ₹[0-9,]+$/);
    await shot(page, "sheet");
  });
});

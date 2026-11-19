import type { Browser, Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test } from "./helpers";

/**
 * H15.7 (E1-B6): for a signed-in visitor the saved ads are the ACCOUNT's, the same on every device, and Remove works on the Saved ads page.
 * A visitor who is not signed in keeps saving on the device. Two separate browsers stand for two devices.
 */

const LISTING = "/dating/bengaluru/";

async function freshDevice(browser: Browser, baseURL: string, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ baseURL, viewport });
  await context.addInitScript(() => {
    localStorage.setItem("nl-age", "ok");
    localStorage.setItem("nl-cookies", "necessary");
  });
  return { context, page: await context.newPage() };
}

async function saveFirstAd(page: Page) {
  await page.goto(LISTING);
  await page.waitForLoadState("networkidle");
  const row = page.locator('[data-tk="listing-row"]').first();
  await expect(row).toBeVisible();
  const title = (await row.locator(".tkh-ad-link").innerText()).trim();
  const heart = row.locator(".tk-row-save");
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(800);
  return title;
}

test.describe("H15.7 saved ads", () => {
  test("a signed-in visitor's saved ads are the account's: a second device sees them, and Remove there clears them everywhere", async ({ browser, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    const viewport = testInfo.project.name === "phone-390" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const user = await newUserApi(baseURL!, "h157saved");
    const first = await freshDevice(browser, baseURL!, viewport);
    await loginUi(first.page, user.email, undefined, "/");
    const title = await saveFirstAd(first.page);

    // A second device (a fresh browser with nothing saved on it) signs in to the same account.
    const second = await freshDevice(browser, baseURL!, viewport);
    await loginUi(second.page, user.email, undefined, "/u/account/saved/");
    await expect(second.page.getByRole("heading", { level: 1, name: "Saved ads" })).toBeVisible();
    await expect(second.page.locator("main").getByText(title).first(), "the second device shows the ad saved on the first").toBeVisible({ timeout: 20_000 });
    await expect(second.page.getByText(/saved in your account/i)).toBeVisible();
    expect(await hasHorizontalScroll(second.page)).toBe(false);

    // Remove on the second device.
    const remove = second.page.locator('[data-tk="saved-remove"]').first();
    await remove.click();
    await expect(second.page.locator("main").getByText(title)).toHaveCount(0);
    await expect(second.page.getByText("Nothing saved yet")).toBeVisible();

    // The first device no longer has it after a reload: the account list was changed, not just one device.
    await first.page.goto("/u/account/saved/");
    await expect(first.page.getByText("Nothing saved yet")).toBeVisible({ timeout: 20_000 });
    await first.page.goto(LISTING);
    await first.page.waitForLoadState("networkidle");
    await expect(first.page.locator('[data-tk="listing-row"]').first().locator(".tk-row-save")).toHaveAttribute("aria-pressed", "false");
    await first.context.close();
    await second.context.close();
    await user.api.dispose();
  });

  test("a visitor who is not signed in keeps saving on the device, and Remove works there too", async ({ browser, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    const viewport = testInfo.project.name === "phone-390" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const device = await freshDevice(browser, baseURL!, viewport);
    const title = await saveFirstAd(device.page);
    await device.page.goto("/u/account/saved/");
    await expect(device.page.locator("main").getByText(title).first()).toBeVisible();
    await expect(device.page.getByText(/saved on this device/i)).toBeVisible();
    await device.page.locator('[data-tk="saved-remove"]').first().click();
    await expect(device.page.getByText("Nothing saved yet")).toBeVisible();
    await device.context.close();
  });
  test("ads saved on the device before signing in go up to the account, so another device sees them", async ({ browser, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    const viewport = testInfo.project.name === "phone-390" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const user = await newUserApi(baseURL!, "h157before");
    const first = await freshDevice(browser, baseURL!, viewport);
    const title = await saveFirstAd(first.page);
    await loginUi(first.page, user.email, undefined, "/u/account/saved/");
    await expect(first.page.locator("main").getByText(title).first()).toBeVisible({ timeout: 20_000 });
    await expect(first.page.getByText(/saved in your account/i)).toBeVisible();
    const second = await freshDevice(browser, baseURL!, viewport);
    await loginUi(second.page, user.email, undefined, "/u/account/saved/");
    await expect(second.page.locator("main").getByText(title).first(), "the ad saved before signing in is in the account").toBeVisible({ timeout: 20_000 });
    await first.context.close();
    await second.context.close();
    await user.api.dispose();
  });
});

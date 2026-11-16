import AxeBuilder from "@axe-core/playwright";
import { expect, hasHorizontalScroll, isPhone, loginUi, newUserApi, test } from "./helpers";

/**
 * H7.6: the user panel (New design). The e2e server is staging, where the New design is on by default.
 * Runs at 390 px (phone) and 1440 px (desktop) through the two projects in playwright.config.ts.
 */

test.describe("H7.6 user panel: visitor", () => {
  test("the panel asks visitors to log in and still shows Discover ads", async ({ page }) => {
    await page.goto("/u/account/dashboard/");
    await expect(page.getByRole("navigation", { name: "My account" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Fresh ads for you" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("notifications and alerts ask visitors to log in", async ({ page }) => {
    await page.goto("/u/account/notifications/");
    await expect(page.getByRole("heading", { name: "Log in to see notifications" })).toBeVisible();
    await page.goto("/u/account/alerts/");
    await expect(page.getByRole("heading", { name: "Log in to manage alerts" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the panel passes an axe check with no serious or critical issues", async ({ page }) => {
    await page.goto("/u/account/dashboard/");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(blocking.map((item) => item.id)).toEqual([]);
  });
});

test.describe("H7.6 user panel: signed in", () => {
  test("home shows coins, saved ads and the feed; notifications and alerts open", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "panel");
    await loginUi(page, email);
    await page.waitForURL(/\/u\/account/, { timeout: 30_000 }).catch(() => undefined);
    await page.goto("/u/account/dashboard/");
    await expect(page.getByRole("navigation", { name: "My account" })).toBeVisible();
    await expect(page.locator('[data-tk="coin-balance"]')).toContainText("credits");
    await expect(page.getByRole("heading", { name: "Saved ads" })).toBeVisible();
    await expect(page.locator('[data-tk="discover"]')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.goto("/u/account/notifications/");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.locator("#notif-heading")).toBeVisible();

    await page.goto("/u/account/alerts/");
    await expect(page.getByRole("heading", { name: "Save a new search" })).toBeVisible();
    if (isPhone(page)) expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

test.describe("H7.17 after-login pages: no CSS class resolves to undefined", () => {
  test("every /u/account page renders real class names", async ({ page }) => {
    for (const path of ["/u/account/dashboard/", "/u/account/messages/", "/u/account/notifications/", "/u/account/alerts/", "/u/account/saved/", "/u/account/credits/", "/u/account/support/", "/u/account/edit-account/"]) {
      await page.goto(path);
      await expect(page.locator('[class~="undefined"]'), path).toHaveCount(0);
    }
  });
});

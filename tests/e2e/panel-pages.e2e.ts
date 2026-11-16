import AxeBuilder from "@axe-core/playwright";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test } from "./helpers";
import type { Page } from "@playwright/test";

const PAGES: { path: string; active: string; heading: RegExp }[] = [
  { path: "/u/account/wallet/", active: "Coins and payments", heading: /^Wallet$/ },
  { path: "/u/account/credits/history/", active: "Coins and payments", heading: /^Transaction history$/ },
  { path: "/u/account/coupons/", active: "Coins and payments", heading: /^Coupons$/ },
  { path: "/u/account/credits/bank/", active: "Coins and payments", heading: /^Bank transfer$/ },
  { path: "/u/account/packs/", active: "Coins and payments", heading: /^Publishing packs$/ },
  { path: "/u/account/subscription/", active: "Settings", heading: /^Subscription$/ },
  { path: "/u/account/analytics/", active: "My ads", heading: /^Analytics$/ },
];

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id);
}

test.describe("H7.80 wallet and payment pages in the account panel", () => {
  test("every page sits in the panel with the right item active, no old title, no sideways scroll, axe 0", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "walletpages");
    await loginUi(page, email, undefined, "/u/account/");
    for (const item of PAGES) {
      await page.goto(item.path);
      const nav = page.getByRole("navigation", { name: "My account" });
      await expect(nav, item.path).toBeVisible();
      await expect(nav.locator("a[aria-current='page']"), item.path).toContainText(item.active);
      await expect(page.getByRole("heading", { level: 1 }), item.path).toHaveText(item.heading);
      await expect(page.getByText(/\bRs \d/)).toHaveCount(0);
      expect(await hasHorizontalScroll(page), item.path).toBe(false);
      expect(await serious(page), item.path).toEqual([]);
    }
    await api.dispose();
  });

  test("the wallet shows rupees with the sign and the coins card", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "walletinr");
    await loginUi(page, email, undefined, "/u/account/wallet/");
    await expect(page.locator(".up-coins-card")).toContainText("0 coins");
    await expect(page.locator(".up-coins-card")).toContainText("₹0");
    await expect(page.getByRole("button", { name: "Earnings" })).toBeVisible();
    await api.dispose();
  });

  test("an empty history has the pink circle icon and a way back", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "histempty");
    await loginUi(page, email, undefined, "/u/account/credits/history/");
    await expect(page.locator(".up-empty-icon")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open coins and payments" })).toHaveAttribute("href", "/u/account/credits/");
    await api.dispose();
  });

  test("a visitor who is not signed in is asked to log in, inside the panel", async ({ page }) => {
    await page.goto("/u/account/wallet/");
    await expect(page.getByRole("heading", { name: "Log in to see your wallet" })).toBeVisible();
  });

  test("the pack picker has Have a coupon? and sends the code with the payment", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "packcoupon");
    await loginUi(page, email, undefined, "/u/account/credits/");
    const packs = page.locator("[data-tk=pack]");
    await expect(packs.first()).toBeVisible();
    await packs.first().click();
    await page.getByRole("button", { name: "Have a coupon?" }).click();
    await page.getByLabel("Coupon code").fill("WELCOME10");
    const sent = page.waitForRequest((request) => request.url().includes("/api/wallet/packs") && request.method() === "POST");
    await page.getByRole("button", { name: /^Pay/ }).click();
    const body = JSON.parse((await sent).postData() || "{}") as { couponCode?: string };
    expect(body.couponCode).toBe("WELCOME10");
    await api.dispose();
  });

  test("the coupon page has an Apply button in sentence case", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "couponpage");
    await loginUi(page, email, undefined, "/u/account/coupons/");
    const apply = page.getByRole("button", { name: "Apply" });
    await expect(apply).toBeVisible();
    expect((await apply.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await api.dispose();
  });
});

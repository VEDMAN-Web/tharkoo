import AxeBuilder from "@axe-core/playwright";
import { becomeSeller, expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, test, withLocalDb } from "./helpers";
import type { APIRequestContext, Page } from "@playwright/test";

const NAV_LABELS = ["Home", "My ads", "Chats", "Saved ads", "Notifications", "Help and support", "Settings"];

async function draftAd(api: APIRequestContext, base: string) {
  const categories = (await (await api.get("/api/categories")).json()).data.categories as { _id: string }[];
  const cities = (await (await api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  for (const category of categories) {
    const res = await api.post("/api/listings", {
      headers: originHeaders(base, "/u/post-insert/"),
      data: { categoryId: category._id, cityId: city.id, title: `Home desk ${Date.now()}`, description: "A wooden desk in good condition for the whole family." },
    });
    if (res.status() === 201) return;
  }
  throw new Error("No category accepted a draft ad");
}

async function openMenu(page: Page) {
  await page.locator('[data-tk="header-avatar"]').click();
  await expect(page.getByRole("menu")).toBeVisible();
}

test.describe("H7.73 one account home", () => {
  test("the avatar menu lists My account, My ads, Chats, Saved ads, Credits, Help, Settings and Log out", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "menu");
    await loginUi(page, email, undefined, "/");
    await openMenu(page);
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "My account" })).toHaveAttribute("href", "/u/account/");
    await expect(menu.getByRole("menuitem", { name: "My ads" })).toHaveAttribute("href", "/u/account/ads/");
    await expect(menu.getByRole("menuitem", { name: "Chats" })).toHaveAttribute("href", "/u/account/messages/");
    await expect(menu.getByRole("menuitem", { name: "Saved ads" })).toHaveAttribute("href", "/u/account/saved/");
    await expect(menu.getByRole("menuitem", { name: "Credits", exact: true })).toHaveAttribute("href", "/u/account/credits/");
    await expect(menu.getByRole("menuitem", { name: "Help and support" })).toHaveAttribute("href", "/u/account/support/");
    await expect(menu.getByRole("menuitem", { name: "Settings" })).toHaveAttribute("href", "/u/account/edit-account/");
    await expect(menu.getByRole("menuitem", { name: "Log out" })).toBeVisible();
    await menu.getByRole("menuitem", { name: "My account" }).click();
    await page.waitForURL((url) => url.pathname === "/u/account/");
  });

  test("a user and an advertiser land on the same home, with every item in the menu, and /dashboard/ is the same page", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "samehome");
    await loginUi(page, email, undefined, "/u/account/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find it, save it, chat with the advertiser");
    const nav = page.getByRole("navigation", { name: "My account" });
    for (const label of NAV_LABELS) await expect(nav.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^Credits and payments/ })).toBeVisible();

    await becomeSeller(page, baseURL!);
    await page.goto("/u/account/");
    await expect(page.getByRole("navigation", { name: "My account" })).toBeVisible();
    // H9.2: an advertiser has no buyer headline; the home starts with Your ads.
    await expect(page.locator("h1")).toHaveText("Your ads");
    await expect(page.locator('[data-tk="availability"]')).toBeVisible();
    await page.goto("/u/account/dashboard/");
    await expect(page.locator("h1")).toHaveText("Your ads");
    await expect(page.getByRole("navigation", { name: "My account" }).getByRole("link", { name: /^Home/ })).toHaveAttribute("aria-current", "page");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("My ads is its own page with its own active item", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "adsactive");
    await draftAd(api, baseURL!);
    await loginUi(page, email, undefined, "/u/account/");
    const nav = page.getByRole("navigation", { name: "My account" });
    await expect(nav.getByRole("link", { name: /^Home/ })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: /^My ads/ })).not.toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: /^My ads/ }).click();
    await page.waitForURL((url) => url.pathname === "/u/account/ads/");
    const next = page.getByRole("navigation", { name: "My account" });
    await expect(next.getByRole("link", { name: /^My ads/ })).toHaveAttribute("aria-current", "page");
    await expect(next.getByRole("link", { name: /^Home/ })).not.toHaveAttribute("aria-current", "page");
    await expect(page.locator("#tkv-ads-title")).toHaveText("My ads");
    await expect(page.locator('[data-tk="owner-card"]').first()).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id)).toEqual([]);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await api.dispose();
  });

  test("the headline follows the counts: a draft only says Finish your draft ad", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "headline");
    await draftAd(api, baseURL!);
    await loginUi(page, email, undefined, "/u/account/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Finish your draft ad");
    await expect(page.locator(".up-hero").getByRole("link", { name: "Finish your ad" })).toHaveAttribute("href", "/u/account/ads/");
    await expect(page.getByText("Your ads are live")).toHaveCount(0);
    await api.dispose();
  });

  test("Withdraw and the Earnings tab show only for an account with earnings", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "withdraw");
    await loginUi(page, email, undefined, "/");
    await becomeSeller(page, baseURL!);
    await page.goto("/u/account/");
    await expect(page.locator('[data-tk="withdraw"]')).toHaveCount(0);
    await page.goto("/u/account/wallet/?tab=earnings");
    await expect(page.getByRole("button", { name: "Earnings" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Buy credits" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Wallet" })).toBeVisible();
  });

  test("empty states show a 72 px pink circle icon, and the chats copy has no seller word", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "empty");
    await loginUi(page, email, undefined, "/u/account/messages/");
    const icon = page.locator(".up-empty-icon").first();
    await expect(icon).toBeVisible();
    const box = (await icon.boundingBox())!;
    expect(Math.round(box.width)).toBe(72);
    expect(Math.round(box.height)).toBe(72);
    await expect(page.locator(".up-empty-box")).toHaveCount(0);
    await expect(page.getByText("Chats you start with advertisers, and people who message you, show here.")).toBeVisible();
    await expect(page.locator("main").getByText(/seller|buyer|vendor/i)).toHaveCount(0);
    await page.goto("/u/account/saved/");
    await expect(page.locator(".up-empty-icon")).toBeVisible();
    await expect(page.locator(".up-empty-box")).toHaveCount(0);
  });
});

import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page } from "@playwright/test";
import { becomeSeller, expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, test } from "./helpers";

/** H9.3: My ads with no ads is one card with the next step; chips with nothing behind them are hidden; no post strip; Photos and videos is in the panel menu. */

const SHOTS = process.env.H93_SHOTS_DIR ?? "";

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

async function draftAd(api: APIRequestContext, base: string, title: string) {
  const categories = (await (await api.get("/api/categories")).json()).data.categories as { _id: string }[];
  const cities = (await (await api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  for (const category of categories) {
    const res = await api.post("/api/listings", { headers: originHeaders(base, "/u/post-insert/"), data: { categoryId: category._id, cityId: city.id, title, description: "A wooden desk in good condition for the whole family." } });
    if (res.status() === 201) return;
  }
  throw new Error("No category accepted a draft ad");
}

test.describe("H9.3 My ads", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("with no ads: one card, a primary Post your first ad, one line on the cost, no chips, no post strip (1440 and 390)", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const { email } = await newUserApi(baseURL!, "h93empty");
    await loginUi(page, email, undefined, "/u/account/");
    await becomeSeller(page, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/u/account/ads/");
      const card = page.locator('[data-tk="my-ads-empty"]');
      await expect(card).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("My ads");
      await expect(card.getByRole("heading", { name: "You have no ads yet" })).toBeVisible();
      const post = card.getByRole("link", { name: "Post your first ad" });
      await expect(post).toHaveAttribute("href", "/u/post-insert/");
      const box = await post.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
      await expect(page.locator('[data-tk="my-ads-cost"]')).toHaveText(/^(Each ad costs .+ to post\.|Posting an ad is free\.)$/);
      await expect(page.getByRole("group", { name: "Filter ads" })).toHaveCount(0);
      await expect(page.getByText("Want to post one like this?")).toHaveCount(0);
      await expect(page.locator('[data-tk="post-strip"]')).toHaveCount(0);
      await expect(page.locator("main, .up-main").getByRole("link", { name: "Post an ad", exact: true })).toHaveCount(0);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "my-ads-empty");
    }
  });

  test("with a draft only, the chips that have nothing behind them are hidden; Photos and videos is in the panel menu and opens with its own item active (1440 and 390)", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const { api, email } = await newUserApi(baseURL!, "h93draft");
    await draftAd(api, baseURL!, `H93 draft ${Date.now() % 100000}`);
    await loginUi(page, email, undefined, "/u/account/");
    await becomeSeller(page, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/u/account/ads/");
      await expect(page.locator('[data-tk="owner-card"]').first()).toBeVisible();
      const chips = page.getByRole("group", { name: "Filter ads" }).getByRole("button");
      await expect(chips).toHaveCount(1);
      await expect(chips.first()).toHaveText(/^All 1$/);
      await expect(page.locator('[data-tk="my-ads-empty"]')).toHaveCount(0);
      await expect(page.locator(".up-main").getByRole("link", { name: "Photos and videos", exact: true })).toHaveCount(0);
      await expect(page.getByText("Want to post one like this?")).toHaveCount(0);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "my-ads-draft");
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const nav = page.getByRole("navigation", { name: "My account" });
    await nav.getByRole("link", { name: "Photos and videos" }).click();
    await page.waitForURL((url) => url.pathname === "/u/account/media/");
    await expect(page.getByRole("navigation", { name: "My account" }).getByRole("link", { name: "Photos and videos" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "My account" }).getByRole("link", { name: /^My ads/ })).not.toHaveAttribute("aria-current", "page");
    await shot(page, "photos-and-videos");
  });
});

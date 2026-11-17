import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page } from "@playwright/test";
import { becomeSeller, expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, test, withLocalDb } from "./helpers";

/** H9.2: the account home of an advertiser starts with "Your ads" and one next step; credits show what they are worth in ads. */

const SHOTS = process.env.H92_SHOTS_DIR ?? "";

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

test.describe("H9.2 advertiser account home", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("an advertiser with no ads sees Your ads, the numbers, ONE Post an ad button, credits in ads, no Withdraw, and no buyer headline (1440 and 390)", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const { email } = await newUserApi(baseURL!, "h92empty");
    await loginUi(page, email, undefined, "/u/account/");
    await becomeSeller(page, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/u/account/");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your ads");
      await expect(page.getByText("Find it, save it, chat with the advertiser")).toHaveCount(0);
      await expect(page.locator('[data-tk="seller-lead"]')).toHaveText("You have no ads yet.");
      await expect(page.locator('[data-tk="seller-stats"] .up-stat-num')).toHaveText(["0", "0", "0"]);
      await expect(page.locator('[data-tk="seller-stats"] .up-stat-label')).toHaveText(["Live", "In review", "Ending soon"]);
      const action = page.locator('[data-tk="seller-action"]');
      await expect(action).toHaveText("Post an ad");
      await expect(action).toHaveAttribute("href", "/u/post-insert/");
      await expect(page.locator('[data-tk="withdraw"]')).toHaveCount(0);
      await expect(page.locator('[data-tk="coin-balance"]')).toContainText("100 credits");
      const worth = page.locator('[data-tk="coin-ads"]');
      if (await worth.count()) await expect(worth).toHaveText(/^About \d+ ads?$/);
      await expect(page.locator('[data-tk="seller-ads"] [data-tk="tour-inbox"]')).toBeVisible();
      // The order on the page: Your ads, then credits, then help.
      const tops = await page.evaluate(() => {
        const top = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().top ?? Number.NaN;
        return { ads: top('[data-tk="seller-home"]'), coins: top("#coins-heading"), help: top("#support-heading") };
      });
      expect(tops.ads).toBeLessThan(tops.coins);
      if (size.width < 900) expect(tops.coins).toBeLessThan(tops.help);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "seller-home-empty");
    }
  });

  test("with an ad that ends soon the one step is Renew, and the Ending soon number counts it (1440 and 390)", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const { api, email } = await newUserApi(baseURL!, "h92end");
    const title = `H92 ending ${Date.now() % 100000}`;
    await draftAd(api, baseURL!, title);
    await loginUi(page, email, undefined, "/u/account/");
    await becomeSeller(page, baseURL!);
    const updated = await withLocalDb((db) => db.collection("listings").updateOne({ title }, { $set: { status: "active", expiresAt: new Date(Date.now() + 2 * 3_600_000), publishedAt: new Date() } }));
    expect(updated?.matchedCount).toBe(1);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/u/account/");
      await expect(page.locator('[data-tk="seller-lead"]')).toHaveText("1 ad ends soon. Renew to keep it showing.");
      await expect(page.locator('[data-tk="seller-stats"] .up-stat-num')).toHaveText(["1", "0", "1"]);
      const action = page.locator('[data-tk="seller-action"]');
      await expect(action).toHaveText("Renew");
      await expect(action).toHaveAttribute("href", "/u/account/ads/");
      await expect(page.locator('[data-tk="seller-ads"]').getByText(title).first()).toBeVisible();
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "seller-home-renew");
    }
  });
});

import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, stubPostingFee, test, withLocalDb } from "./helpers";

const SHOTS = process.env.POST_SHOTS ?? "";

async function liveAd(api: APIRequestContext, base: string, slug: string) {
  const categories = (await (await api.get("/api/categories")).json()).data.categories as { _id: string }[];
  const cities = (await (await api.get("/api/locations?type=city")).json()).data.locations as { id: string }[];
  for (const category of categories) {
    const res = await api.post("/api/listings", {
      headers: originHeaders(base, "/u/post-insert/"),
      data: { categoryId: category._id, cityId: cities[0].id, title: `Strip desk ${Date.now()}`, description: "A wooden desk in good condition for the whole family." },
    });
    if (res.status() === 201) {
      const id = ((await res.json()).data as { id: string }).id;
      await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(id) }, { $set: { status: "active", slug, publishedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) } }));
      return id;
    }
  }
  throw new Error("No category accepted a draft ad");
}

async function shots(page: Page, name: string) {
  if (!SHOTS) return;
  for (const [width, height] of [[1536, 674], [1366, 768], [390, 844]] as [number, number][]) {
    await page.setViewportSize({ width, height });
    await page.locator("[data-tk=post-strip]").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/h7-109-strip-${name}-${width}x${height}.png` });
  }
}

test.describe("3-5 the Want to post one like this strip", () => {
  test("the ad page and My ads end with a neutral strip: no free claim, a Post your ad button, and the fee only when posting is paid", async ({ page, baseURL }, info) => {
    test.setTimeout(180_000);
    const slug = `strip-desk-${Date.now()}`;
    const owner = await newUserApi(baseURL!, "stripowner");
    await liveAd(owner.api, baseURL!, slug);

    await page.goto(`/ad/${slug}/`);
    const strip = page.locator("[data-tk=post-strip]");
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("Want to post one like this? Post your ad in 2 minutes.");
    await expect(strip).not.toContainText(/free/i);
    await expect(strip.locator("[data-tk=post-strip-fee]")).toHaveCount(0);
    await expect(strip.locator("[data-tk=post-strip-button]")).toHaveAttribute("href", "/u/post-insert/");
    expect((await strip.locator("[data-tk=post-strip-button]").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await hasHorizontalScroll(page)).toBe(false);
    const found = await new AxeBuilder({ page }).include("[data-tk=post-strip]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id)).toEqual([]);
    await shots(page, "ad");
    await page.setViewportSize(info.project.use.viewport ?? { width: 1440, height: 900 });

    await stubPostingFee(page);
    await loginUi(page, owner.email, undefined, "/u/account/ads/");
    const mine = page.locator("[data-tk=post-strip]");
    await expect(mine).toBeVisible();
    await expect(mine.locator("[data-tk=post-strip-fee]")).toHaveText("It costs 30 credits.");
    await expect(mine).not.toContainText(/free/i);
    await shots(page, "myads");

    await page.goto(`/ad/${slug}/`);
    await expect(page.locator("[data-tk=post-strip] [data-tk=post-strip-fee]")).toHaveText("It costs 30 credits.");
    await owner.api.dispose();
  });
});

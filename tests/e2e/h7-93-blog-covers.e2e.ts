import { expect, hasHorizontalScroll, test, withLocalDb } from "./helpers";

const SIZES = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 1536, height: 674 },
];

const COVER = "https://res.cloudinary.com/tat1zj72/image/upload/v1794815500/tharkoo/site/6afab60c0a35b1df43d37886.jpg";

test.describe("H7.93: blog covers come from the blog record", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  for (const size of SIZES) {
    test(`the cover shows on the blog list and the post at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/blog/");
      const card = page.locator(".tkp-blog-card, .tkp-feature", { has: page.locator(`img.tkp-cover-img[src="${COVER}"]`) }).first();
      const image = card.locator("img.tkp-cover-img");
      await expect(image).toHaveAttribute("alt", "Two friends chatting over coffee in a busy cafe at dusk");
      expect(await image.evaluate((el) => getComputedStyle(el).objectPosition)).toBe("60% 40%");
      const box = (await image.locator("xpath=..").boundingBox())!;
      if ((await card.getAttribute("class"))?.includes("tkp-blog-card")) expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.03);
      expect(await hasHorizontalScroll(page)).toBe(false);

      await page.goto("/blog/stay-safe/");
      const cover = page.locator('[data-tk="blog-cover"]');
      await expect(cover).toHaveAttribute("data-cover", "photo");
      await expect(cover.locator("img")).toHaveAttribute("src", COVER);
      const photo = (await cover.boundingBox())!;
      expect(photo.height).toBeLessThanOrEqual(381);
      expect(photo.height).toBeGreaterThan(150);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await expect(page.locator("h1")).toHaveCount(1);
    });
  }

  test("a post with no cover keeps the pink placeholder band", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/blog/how-star-works/");
    const band = page.locator('[data-tk="blog-cover"]');
    await expect(band).toBeVisible();
    await expect(band).not.toHaveAttribute("data-cover", "photo");
    expect(Math.round((await band.boundingBox())!.height)).toBe(200);
  });

  test("a cover set on another blog record shows on its card and its post", async ({ page }) => {
    const set = await withLocalDb((db) =>
      db.collection("blog_posts").updateOne({ slug: "most-searched-hyderabad" }, { $set: { cover: COVER, coverAlt: "A cafe table", coverFocus: "40% 30%" } }),
    );
    expect(set, "E2E_MONGO_URI_FILE must point at the in-memory database").toBeTruthy();
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(500);
      await page.goto("/blog/most-searched-hyderabad/");
      await expect(page.locator('[data-tk="blog-cover"] img')).toHaveAttribute("alt", "A cafe table");
      expect(await page.locator('[data-tk="blog-cover"] img').evaluate((el) => getComputedStyle(el).objectPosition)).toBe("40% 30%");
    } finally {
      await withLocalDb((db) => db.collection("blog_posts").updateOne({ slug: "most-searched-hyderabad" }, { $unset: { cover: "", coverAlt: "", coverFocus: "" } }));
    }
  });
});

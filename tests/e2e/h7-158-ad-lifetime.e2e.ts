import { createLiveAd } from "./flows";
import { expect, setListingExpiry, test, withLocalDb } from "./helpers";

const HOUR = 60 * 60 * 1000;

test.describe("H7.158 ads live 48 hours", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "no screen to size");
  });

  test("a new ad ends 48 hours after it goes live", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "life48");
    const slug = ad.adHref.split("/").filter(Boolean)[1];
    const row = await withLocalDb((db) => db.collection("listings").findOne({ slug }, { projection: { publishedAt: 1, expiresAt: 1, status: 1 } }));
    expect(row?.status).toBe("active");
    const span = new Date(row!.expiresAt).getTime() - new Date(row!.publishedAt).getTime();
    expect(Math.abs(span - 48 * HOUR)).toBeLessThan(10 * 60 * 1000);
  });

  test("an ad past its end time is gone from search at once, even though the cron has not run", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "lifegone");
    const slug = ad.adHref.split("/").filter(Boolean)[1];
    const found = async () => {
      const res = await page.request.get(`/api/search?q=${encodeURIComponent(ad.title)}`);
      expect(res.status()).toBe(200);
      return JSON.stringify(await res.json()).includes(ad.title);
    };
    await expect.poll(found, { timeout: 60_000, intervals: [2_000] }).toBe(true);
    expect(await setListingExpiry(slug, new Date(Date.now() - 60_000))).toBe(true);
    const row = await withLocalDb((db) => db.collection("listings").findOne({ slug }, { projection: { status: 1 } }));
    expect(row?.status).toBe("active");
    await expect.poll(found, { timeout: 30_000, intervals: [1_000] }).toBe(false);
  });
});

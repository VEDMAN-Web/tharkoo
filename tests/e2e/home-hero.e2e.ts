import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H6.13: the home hero is a full banner by default (one photo edge to edge, text on top), and the banner can be replaced or removed. */

const SHOTS = join(process.cwd(), ".shots", "H6.13");
const WIDTHS = [360, 390, 768, 1440];

test.describe("H6.13 hero banner (H7.136: current Home markup)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
  });

  test("the public banner is one picture with one H1, no overflow, and the search card sits on its lower edge, at 360, 390, 768 and 1440", async ({ page }, testInfo) => {
    // The public page runs once, at desktop width; the test sets its own viewports.
    test.skip(testInfo.project.name !== "desktop-1440", "runs once, at desktop width");
    mkdirSync(SHOTS, { recursive: true });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto("/");
      const banner = page.locator(".tkh-banner").first();
      await expect(banner).toBeVisible();
      const box = (await banner.boundingBox())!;

      // The banner picture is visible, fills the banner width and has a real size.
      const photo = banner.locator("img.tkh-banner-img").first();
      await expect(photo).toBeVisible();
      const photoBox = (await photo.boundingBox())!;
      expect(photoBox.width, `photo spans the banner at ${width}`).toBeGreaterThanOrEqual(box.width - 1);
      expect(photoBox.height, `photo has a real height at ${width}`).toBeGreaterThan(150);
      expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth), `photo loaded at ${width}`).toBeGreaterThan(0);

      // One H1 on the page, and it is visible.
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1").first()).toBeVisible();

      // The search card is part of the banner block: its top is inside the banner's lower part when the headline is in the picture
      // (any width) or on a desktop; on a phone with a text card it sits just below the card.
      const search = page.locator("form.tkh-search").first();
      await expect(search).toBeVisible();
      const searchBox = (await search.boundingBox())!;
      const inPicture = (await banner.getAttribute("data-text-in-image")) === "true";
      if (inPicture || width >= 1024) {
        expect(searchBox.y, `search card starts above the banner bottom at ${width}`).toBeLessThan(box.y + box.height);
        expect(searchBox.y, `search card starts in the lower part of the banner at ${width}`).toBeGreaterThan(box.y + box.height * 0.6);
        expect(searchBox.y + searchBox.height, `search card ends below the banner bottom at ${width}`).toBeGreaterThan(box.y + box.height);
      } else {
        expect(searchBox.y, `search card is below the banner at ${width}`).toBeGreaterThanOrEqual(box.y + box.height - 1);
      }

      expect(await hasHorizontalScroll(page), `no horizontal scroll at ${width}`).toBe(false);
      await page.screenshot({ path: join(SHOTS, `home-hero-banner-${width}.png`) });
    }
  });

});

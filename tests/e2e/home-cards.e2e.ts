import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, hasHorizontalScroll, test } from "./helpers";

/** H6.13: category card photos. 4:5 on phones (under 640 px), 3:2 on tablet and desktop, the box reserved before the photo loads. */

const SHOTS = join(process.cwd(), ".shots", "H6.13");

test.describe("H6.13 category card photos", () => {
  test("phone cards are 4:5, desktop and tablet cards are 3:2, at 360, 390, 768 and 1440", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "runs once, at desktop width");
    mkdirSync(SHOTS, { recursive: true });

    // Height divided by width: 4:5 portrait is 1.25, 3:2 landscape is 0.667.
    const expected: [number, number][] = [
      [360, 5 / 4],
      [390, 5 / 4],
      [768, 2 / 3],
      [1440, 2 / 3],
    ];
    for (const [width, shape] of expected) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto("/");
      // H12.1: a category with no photo shows a short coloured strip with its icon (never a tall empty box); a category with a photo
      // keeps the reserved 4:5 / 3:2 box. Check each kind by what it is.
      await expect(page.locator(".tkh-cat-photo").first()).toBeVisible();
      const withPhoto = page.locator("img.tkh-cat-photo");
      if (await withPhoto.count()) {
        const box = await withPhoto.first().boundingBox();
        expect(box, `card photo box at ${width}`).not.toBeNull();
        expect(box!.height / box!.width, `card photo shape at ${width}`).toBeCloseTo(shape, 1);
      }
      const empties = page.locator(".tkh-cat-photo.tkh-cat-empty");
      for (let i = 0; i < (await empties.count()); i += 1) {
        const strip = empties.nth(i);
        const box = await strip.boundingBox();
        expect(box, `no-photo strip box at ${width}`).not.toBeNull();
        expect(box!.height, `no-photo strip is a short strip, not a tall empty box, at ${width}`).toBeLessThan(box!.width * 0.6);
        await expect(strip.locator(".tkh-cat-icon"), `no-photo strip shows its icon at ${width}`).toBeVisible();
        const fill = await strip.evaluate((node) => getComputedStyle(node).backgroundImage);
        expect(fill, `no-photo strip has its colour fill at ${width}`).not.toBe("none");
      }
      expect((await withPhoto.count()) + (await empties.count()), `every category card has a photo or a strip at ${width}`).toBeGreaterThan(0);

      expect(await hasHorizontalScroll(page), `no horizontal scroll at ${width}`).toBe(false);
      await page.screenshot({ path: join(SHOTS, `home-cards-${width}.png`), fullPage: false });
    }
  });
});

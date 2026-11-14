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
      const photo = page.locator(".tk-home-photo").first();
      await expect(photo).toBeVisible();
      const box = await photo.boundingBox();
      expect(box, `card photo box at ${width}`).not.toBeNull();
      expect(box!.height / box!.width, `card photo shape at ${width}`).toBeCloseTo(shape, 1);

      // The image fills the box, and its size hint matches the card column.
      const img = photo.locator("img").first();
      const imgBox = await img.boundingBox();
      expect(imgBox!.width, `image fills the card at ${width}`).toBeGreaterThanOrEqual(box!.width - 1);
      expect(imgBox!.height, `image fills the card height at ${width}`).toBeGreaterThanOrEqual(box!.height - 1);
      await expect(img).toHaveAttribute("sizes", "(max-width: 640px) 92vw, 300px");

      // Without a chosen focal point the photo is centred.
      await expect(photo).toHaveAttribute("data-focus", "center");
      await expect(img).toHaveCSS("object-position", /50% 50%|center center/);

      expect(await hasHorizontalScroll(page), `no horizontal scroll at ${width}`).toBe(false);
      await page.screenshot({ path: join(SHOTS, `home-cards-${width}.png`), fullPage: false });
    }
  });
});

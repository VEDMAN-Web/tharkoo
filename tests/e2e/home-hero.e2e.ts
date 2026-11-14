import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H6.13: the home hero is a full banner by default (one photo edge to edge, text on top), and the banner can be replaced or removed. */

const SHOTS = join(process.cwd(), ".shots", "H6.13");
const WIDTHS = [360, 390, 768, 1440];

function heroBlock(page: Page) {
  return page.locator("li.lay-block").filter({ has: page.locator(".lay-type", { hasText: /^hero$/ }) });
}

test.describe("H6.13 hero is a full banner by default", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
  });

  test("the public hero is one banner at 360, 390, 768 and 1440, text above the photo, no gradient, no overflow", async ({ page }, testInfo) => {
    // The public page runs once, at desktop width; the test sets its own viewports.
    test.skip(testInfo.project.name !== "desktop-1440", "runs once, at desktop width");
    mkdirSync(SHOTS, { recursive: true });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto("/");
      const section = page.locator('section[data-tk="hero"]');
      await expect(section).toHaveAttribute("data-layout", "full");
      await expect(section).toHaveAttribute("data-overlay", "none");

      const box = await section.boundingBox();
      expect(box, `hero box at ${width}`).not.toBeNull();
      expect(Math.abs(box!.x), `hero starts at the left edge at ${width}`).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.width - width), `hero is full width at ${width}`).toBeLessThanOrEqual(1);

      // The photo fills the banner edge to edge.
      const photo = section.locator("img.tk-hero-photo").first();
      await expect(photo).toBeVisible();
      const photoBox = await photo.boundingBox();
      expect(photoBox!.width, `photo spans the banner at ${width}`).toBeGreaterThanOrEqual(box!.width - 1);
      expect(photoBox!.height, `photo spans the banner height at ${width}`).toBeGreaterThanOrEqual(box!.height - 1);

      // The heading and the search sit on top of the photo, inside the banner, and nothing is clipped.
      const heading = section.locator("h1");
      await expect(heading).toBeVisible();
      const search = section.locator(".tk-hero-search");
      await expect(search).toBeVisible();
      const searchBox = await search.boundingBox();
      expect(searchBox!.y + searchBox!.height, `search box is inside the banner at ${width}`).toBeLessThanOrEqual(box!.y + box!.height + 1);
      expect(searchBox!.y, `search box is below the top of the banner at ${width}`).toBeGreaterThanOrEqual(box!.y);

      // No dark gradient is laid over the photo by default.
      const layer = await section.evaluate((node) => getComputedStyle(node, "::after").display);
      expect(layer, `no gradient layer at ${width}`).toBe("none");

      expect(await hasHorizontalScroll(page), `no horizontal scroll at ${width}`).toBe(false);
      await page.screenshot({ path: join(SHOTS, `home-hero-full-${width}.png`) });
    }
  });

  test("the hero editor offers upload, library, replace and remove for the banner, with the sizes in the help", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "runs once, at desktop width");
    await page.goto("/admin/homepage/");
    await expect(page.locator("li.lay-block").first()).toBeVisible();
    const hero = heroBlock(page);
    await hero.getByRole("button", { name: "Edit", exact: true }).click();

    // The layout starts on the full banner.
    await expect(hero.getByLabel("Layout")).toHaveValue("full");

    const desktop = hero.locator(".lay-image", { hasText: "Image for desktop" });
    await expect(desktop.getByText("Up to 8 MB (2 MB or less loads faster). Recommended 1920 x 640 px.")).toBeVisible();
    await expect(desktop.getByRole("button", { name: "Upload new banner" })).toBeVisible();

    const phone = hero.locator(".lay-image", { hasText: "Image for phone (optional)" });
    await expect(phone.getByText("Recommended 1080 x 1350 px.")).toBeVisible();
    await expect(phone.getByRole("button", { name: "Upload new banner" })).toBeVisible();
    // The phone photo is optional: its remove button only shows when a photo is set.
    await expect(phone.getByRole("button", { name: "Remove banner" })).toHaveCount(0);

    // The library and upload dialogs open from the banner buttons.
    await desktop.getByRole("button", { name: /Choose from media library|Replace/ }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Library" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await desktop.getByRole("button", { name: "Upload new banner" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Upload and use" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  });
});

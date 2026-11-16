import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";

async function edges(page: Page) {
  return page.evaluate(() => {
    const band = document.querySelector('[data-tk="listing-band"]')!.getBoundingClientRect();
    const grid = document.querySelector(".tkn-ls-grid")!;
    const box = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    return {
      bandLeft: band.left,
      bandRight: band.right,
      bandHeight: band.height,
      contentLeft: box.left + parseFloat(style.paddingLeft),
      contentRight: box.right - parseFloat(style.paddingRight),
    };
  });
}

test.describe("H7.67: listing title band", () => {
  test.beforeEach(() => {
    test.skip(true, "the photo band is off by default (H7.104); these tests describe the optional band");
  });
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  for (const [width, height, band] of [
    [1440, 900, 400],
    [1023, 900, 360],
    [768, 1024, 360],
  ] as const) {
    for (const path of ["/dating/surat/", "/cities/surat/"]) {
      test(`${path} band is ${band} px high and lines up with the content at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto(path);
        const found = await edges(page);
        expect(Math.round(found.bandHeight)).toBe(band);
        expect(Math.abs(found.bandLeft - found.contentLeft)).toBeLessThanOrEqual(1);
        expect(Math.abs(found.bandRight - found.contentRight)).toBeLessThanOrEqual(1);
        const bandEl = page.locator('[data-tk="listing-band"]');
        expect(await bandEl.evaluate((el) => getComputedStyle(el, "::before").content)).toBe("none");
        expect(await bandEl.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("28px");
        expect(await bandEl.locator(".tkn-ls-band-card").evaluate((el) => getComputedStyle(el).backdropFilter)).toContain("blur(14px)");
        expect(await hasHorizontalScroll(page)).toBe(false);
      });
    }
  }

  test("on a phone the photo block is 260 px with the glass card below it, overlapping at most 24 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dating/surat/");
    const band = page.locator('[data-tk="listing-band"]');
    expect(await band.evaluate((el) => getComputedStyle(el, "::before").height)).toBe("260px");
    const bandBox = (await band.boundingBox())!;
    const card = (await band.locator(".tkn-ls-band-card").boundingBox())!;
    expect(card.y).toBeGreaterThanOrEqual(bandBox.y + 260 - 24 - 1);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the city page has the filter column on the left and the list at the category width", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cities/surat/");
    const aside = (await page.locator(".tkn-ls-aside-nav").boundingBox())!;
    const main = (await page.locator(".tkn-ls-main").boundingBox())!;
    expect(Math.round(aside.width)).toBe(260);
    expect(main.x).toBeGreaterThan(aside.x + aside.width);
    expect(Math.round(main.width)).toBeLessThanOrEqual(880);
    await expect(page.locator('[data-tk="city-nav-categories"] a').first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/cities/surat/");
    await expect(page.locator(".tkn-ls-aside-nav")).toBeHidden();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

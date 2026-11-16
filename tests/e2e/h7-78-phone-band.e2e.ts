import { expect, hasHorizontalScroll, test } from "./helpers";

test.describe("H7.78: phone band", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  for (const width of [390, 600]) {
    for (const path of ["/friendship/", "/dating/surat/", "/cities/surat/"]) {
      test(`${path} card edges equal the photo edges at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(path);
        const band = page.locator('[data-tk="listing-band"]');
        const bandBox = (await band.boundingBox())!;
        const cardBox = (await band.locator(".tkn-ls-band-card").boundingBox())!;
        expect(Math.abs(cardBox.x - bandBox.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(cardBox.x + cardBox.width - (bandBox.x + bandBox.width))).toBeLessThanOrEqual(1);
        expect(bandBox.x).toBeCloseTo(width === 390 ? 16 : 20, 0);
        expect(await hasHorizontalScroll(page)).toBe(false);
        const h1 = (await band.locator("h1").boundingBox())!;
        const next = (await band.locator(".tkn-ls-intro, .tkn-ls-searchrow").first().boundingBox())!;
        expect(next.y - (h1.y + h1.height)).toBeLessThanOrEqual(16);
        const intro = band.locator(".tkn-ls-intro");
        const row = (await band.locator(".tkn-ls-searchrow").boundingBox())!;
        if (await intro.count()) {
          const introBox = (await intro.boundingBox())!;
          expect(row.y - (introBox.y + introBox.height)).toBeLessThanOrEqual(16);
        }
      });
    }
  }

  test("Filters is the secondary button and Search the only filled one", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/friendship/");
    const filters = page.locator(".tkn-ls-filter-btn");
    const search = page.locator(".tkn-ls-band .tkn-ls-go");
    await expect(filters).toBeVisible();
    await expect(filters.locator("svg")).toHaveCount(1);
    const style = await filters.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { background: cs.backgroundColor, border: cs.borderTopWidth, borderColor: cs.borderTopColor, color: cs.color };
    });
    expect(style.background).toBe("rgb(255, 255, 255)");
    expect(style.border).toMatch(/^1(\.5)?px$/);
    expect(style.borderColor).not.toBe("rgba(0, 0, 0, 0)");
    expect((await search.evaluate((el) => getComputedStyle(el).backgroundImage))).toContain("gradient");
    const row = (await filters.boundingBox())!;
    expect(row.height).toBeGreaterThanOrEqual(44);
  });

  test("the filter column says nothing about missing filters when no category is chosen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/");
    await expect(page.locator(".tkn-ls-aside")).toBeVisible();
    await expect(page.locator(".tkn-ls-empty")).toHaveCount(0);
  });
});

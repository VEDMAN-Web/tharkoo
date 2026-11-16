import { expect, hasHorizontalScroll, test } from "./helpers";

const countOf = (text: string) => Number((text.match(/[\d,]+/) || ["0"])[0].replace(/,/g, ""));

test.describe("H7.91: sticky, instant filter column and phone sheet", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  test("a quick filter applies at once and the live count follows", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating");
    const show = page.locator('[data-tk="show-count"]');
    await expect(show).toHaveText(/^Show [\d,]+ ads?$/);
    const before = countOf(await page.locator('[data-tk="results-count"]').innerText());
    expect(countOf(await show.innerText())).toBe(before);
    await page.locator(".tkn-ls-aside").getByText("Verified", { exact: true }).click();
    await expect(page).toHaveURL(/verified=1/);
    await expect(page.locator('[data-chip="verified"]')).toBeVisible();
    const after = countOf(await page.locator('[data-tk="results-count"]').innerText());
    expect(after).toBeLessThanOrEqual(before);
    await expect.poll(async () => countOf(await show.innerText())).toBe(after);
  });

  test("the column is compact and stays in view while the results scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating");
    const aside = page.locator(".tkn-ls-aside");
    const box = (await aside.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(800);
    const selects = aside.locator(".tkn-ls-select select");
    for (let i = 0; i < (await selects.count()); i += 1) {
      expect((await selects.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    const state = (await aside.locator(".tkn-ls-select").nth(1).boundingBox())!;
    const city = (await aside.locator(".tkn-ls-select").nth(2).boundingBox())!;
    expect(Math.abs(state.y - city.y)).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(300);
    const scrolled = (await aside.boundingBox())!;
    expect(scrolled.y).toBeGreaterThanOrEqual(60);
    expect(scrolled.y).toBeLessThanOrEqual(110);
    expect(scrolled.y + scrolled.height).toBeLessThanOrEqual(900);
    await expect(page.locator('[data-tk="show-count"]')).toBeInViewport();
  });

  test("on a phone the bar sticks under the header and Filters opens a full-height sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search/?category=dating&city=surat");
    await expect(page.locator('[data-tk="active-chips"]')).toBeVisible();
    await expect(page.locator(".tkn-ls-aside")).not.toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(300);
    const bar = (await page.locator('[data-tk="results-bar"]').boundingBox())!;
    expect(bar.y).toBeGreaterThanOrEqual(60);
    expect(bar.y).toBeLessThanOrEqual(90);
    await page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn').click();
    const aside = page.locator(".tkn-ls-aside");
    await expect(aside).toHaveAttribute("data-open", "true");
    expect((await aside.boundingBox())!.height).toBeGreaterThanOrEqual(800);
    await aside.getByText("Verified", { exact: true }).click();
    await expect(page).toHaveURL(/verified=1/);
    await expect(aside).toHaveAttribute("data-open", "true");
    await page.locator('[data-tk="show-count"]').click();
    await expect(aside).toHaveAttribute("data-open", "false");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the sheet closes with its close button and with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search/");
    const aside = page.locator(".tkn-ls-aside");
    await page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn').click();
    await expect(aside).toHaveAttribute("data-open", "true");
    await aside.locator(".tkn-ls-sheet-close").click();
    await expect(aside).toHaveAttribute("data-open", "false");
    await page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn').click();
    await page.keyboard.press("Escape");
    await expect(aside).toHaveAttribute("data-open", "false");
  });

  test("category pages get the same phone bar and the sticky column", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dating/");
    await expect(page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn')).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dating/");
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(300);
    const aside = (await page.locator(".tkn-ls-aside").boundingBox())!;
    expect(aside.y).toBeGreaterThanOrEqual(60);
    expect(aside.y).toBeLessThanOrEqual(110);
  });
});

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

  test("the number of active filters equals the number of chips, on the column and on the phone button", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating&city=surat&verified=1&online=1");
    await expect(page.locator('[data-tk="active-chips"] .tkn-sr-chip')).toHaveCount(4);
    await expect(page.locator(".tkn-ls-aside .tkn-ls-pill")).toHaveText("4 active");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn')).toContainText("Filters \u00b7 4");
  });

  test("the keyword placeholder fits the column", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/");
    const input = page.locator(".tkn-kw input");
    await expect(input).toHaveAttribute("placeholder", "e.g. yoga, bike, flat");
    const fits = await input.evaluate((el) => {
      const probe = document.createElement("span");
      const cs = getComputedStyle(el);
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font}`;
      probe.textContent = (el as HTMLInputElement).placeholder;
      document.body.appendChild(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width <= el.clientWidth - 24;
    });
    expect(fits).toBe(true);
  });

  test("an empty result says that ads close by are shown, and the post button is a real button", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/search/?category=dating&city=surat&online=1&verified=1&video=1");
    await expect(page.locator('[data-tk="results-count"]')).toHaveText("0 ads in Surat \u00b7 showing ads close by");
    const button = page.locator('[data-tk="fallback-lead"] .tk-btn');
    await expect(button).toBeVisible();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await button.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("gradient");
    const lead = (await page.locator('[data-tk="fallback-lead"]').boundingBox())!;
    const box = (await button.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(lead.x + lead.width - 40);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search/?category=dating&city=surat&online=1&verified=1&video=1");
    const phoneButton = (await page.locator('[data-tk="fallback-lead"] .tk-btn').boundingBox())!;
    const phoneLead = (await page.locator('[data-tk="fallback-lead"]').boundingBox())!;
    expect(phoneButton.width).toBeGreaterThan(phoneLead.width - 50);
  });

  test("a list card shows no views or clicks and is about 200 px high with a 200 px photo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating");
    const card = page.locator('[data-tk="card"]').first();
    await expect(page.locator('[data-tk="ad-counts"]')).toHaveCount(0);
    await expect(card).not.toContainText(/\bviews?\b|\bclicks?\b/);
    const box = (await card.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(190);
    expect(box.height).toBeLessThanOrEqual(225);
    const photo = (await card.locator(".tkn-ls-photo").boundingBox())!;
    expect(Math.round(photo.width)).toBe(200);
    expect(await card.locator(".tkn-ls-photo img").first().evaluate((el) => getComputedStyle(el).objectPosition)).toBe("50% 18%");
  });
});

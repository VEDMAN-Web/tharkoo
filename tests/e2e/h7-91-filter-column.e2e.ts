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
    await expect(show).toBeHidden();
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
    await expect(page.locator(".tkn-ls-aside .tkn-ls-pill")).toHaveText("4");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn')).toContainText("Filters \u00b7 4");
  });

  test("the keyword placeholder fits the column", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/");
    const input = page.locator(".tkn-kw input");
    await expect(input).toHaveAttribute("placeholder", "Search keyword");
    const fits = await input.evaluate((el) => {
      const probe = document.createElement("span");
      const cs = getComputedStyle(el);
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font}`;
      probe.textContent = (el as HTMLInputElement).placeholder;
      document.body.appendChild(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width <= el.clientWidth - 46;
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

  for (const size of [
    { width: 1366, height: 768 },
    { width: 1536, height: 730 },
    { width: 1536, height: 674 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    for (const path of ["/search/?category=dating&state=gujarat", "/dating/surat/"]) {
      test(`the filter column never scrolls and fits the window at ${size.width}x${size.height} on ${path}`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(path);
        const aside = page.locator(".tkn-ls-aside");
        const measure = () =>
          aside.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, top: el.getBoundingClientRect().top }));
        const fit = async (label: string) => {
          const box = (await aside.boundingBox())!;
          const m = await measure();
          expect(m.scroll, `${label}: no scrollbar`).toBeLessThanOrEqual(m.client);
          expect(box.height, `${label}: at most 500 px`).toBeLessThanOrEqual(500);
          expect(box.height, `${label}: fits the window`).toBeLessThanOrEqual(size.height - 70 - 32);
          expect(Math.round(box.width)).toBe(272);
          const inner = await page.locator(".tkn-ls-form .tkn-ls-acc").evaluate((el) => el.scrollHeight - el.clientHeight);
          expect(inner, `${label}: the accordion list does not scroll`).toBeLessThanOrEqual(1);
        };
        await fit("closed");
        const rows = page.locator(".tkn-ls-row-btn");
        expect(await rows.count()).toBeGreaterThan(0);
        for (let i = 0; i < (await rows.count()); i += 1) {
          await rows.nth(i).click();
          await expect(rows.nth(i)).toHaveAttribute("aria-expanded", "true");
          expect(await page.locator('.tkn-ls-row-btn[aria-expanded="true"]').count()).toBe(1);
          await fit(`row ${i} open`);
        }
        expect(await hasHorizontalScroll(page)).toBe(false);
      });
    }
  }

  test("the column starts closed: header with count, keyword, selects, 2x2 toggles and accordions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating&state=gujarat");
    const aside = page.locator(".tkn-ls-aside");
    await expect(aside.locator(".tkn-ls-panelhead-title")).toContainText("Filters");
    await expect(aside.locator(".tkn-ls-label")).toHaveCount(0);
    await expect(aside.locator(".tkn-ls-go")).toBeHidden();
    await expect(aside.locator('.tkn-ls-select select[aria-label="Area"]')).toHaveCount(0);
    await expect(aside.locator('select[aria-label="Category"] option').first()).toHaveText("All categories");
    const toggles = aside.locator(".tkn-ls-chipline");
    expect(await toggles.count()).toBeGreaterThanOrEqual(4);
    const first = (await toggles.nth(0).boundingBox())!;
    const second = (await toggles.nth(1).boundingBox())!;
    const third = (await toggles.nth(2).boundingBox())!;
    expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
    expect(third.y).toBeGreaterThan(first.y + 30);
    expect(Math.round(first.height)).toBe(36);
    await expect(aside.locator('.tkn-ls-row-btn[aria-expanded="true"]')).toHaveCount(0);
    for (const control of await aside.locator("select, .tkn-kw input, .tkn-ls-row").all()) {
      expect(Math.round((await control.boundingBox())!.height)).toBe(40);
    }
    const choice = aside.locator(".tkn-ls-row", { has: page.locator(".tkn-ls-opt") }).first();
    await choice.locator(".tkn-ls-row-btn").click();
    await choice.locator(".tkn-ls-opt").first().click();
    await expect(page).toHaveURL(/f\./);
    await expect(choice.locator(".tkn-ls-row-btn")).toContainText("· 1");
  });

  // H14.1: Vedant's approved row shows views and clicks (real counters) and the plan badge, so this test now checks that.
  test("a list card shows its real views and clicks with icons, and no owner counts", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating");
    const card = page.locator('[data-tk="listing-row"]').first();
    await expect(page.locator('[data-tk="ad-counts"]')).toHaveCount(0);
    await expect(card.locator('[data-tk="row-views"] svg')).toHaveCount(1);
    await expect(card.locator('[data-tk="row-clicks"] svg')).toHaveCount(1);
    await expect(card.locator('[data-tk="row-stats"]')).toHaveAttribute("data-ready", "true", { timeout: 40_000 });
    await expect(card.locator('[data-tk="row-views"]')).toContainText(/\d/);
  });
});

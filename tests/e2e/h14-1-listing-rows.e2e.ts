import { mkdirSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, isPhone, test } from "./helpers";

/** H14.1: the listing card is the approved row (SiteListing artboard) everywhere except Home. */

const SHOTS = process.env.H14_SHOTS_DIR || join(process.cwd(), ".shots", "H14.1");
const PAGES = ["/dating/", "/jobs/mumbai/", "/search/?category=dating"];
const ROW = '[data-tk="listing-row"]';

async function shot(page: Page, name: string, testInfo: { project: { name: string } }) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}-${testInfo.project.name}.png`) });
}

async function styles(page: Page) {
  return page.locator(ROW).first().evaluate((card) => {
    const css = (selector: string, prop: string) => {
      const node = card.querySelector(selector);
      return node ? (getComputedStyle(node) as unknown as Record<string, string>)[prop] : null;
    };
    const rect = (selector: string) => card.querySelector(selector)?.getBoundingClientRect() ?? null;
    const own = getComputedStyle(card);
    const photo = rect(".tk-row-photo");
    const price = card.querySelector('[data-tk="card-price"]');
    return {
      display: own.display,
      direction: own.flexDirection,
      radius: own.borderRadius,
      border: `${own.borderTopWidth} ${own.borderTopColor}`,
      shadow: own.boxShadow,
      photoWidth: photo?.width ?? 0,
      photoHeight: photo?.height ?? 0,
      cardWidth: card.getBoundingClientRect().width,
      cardHeight: card.getBoundingClientRect().height,
      bodyPadding: css(".tk-row-body", "padding"),
      bodyGap: css(".tk-row-body", "rowGap"),
      titleSize: css(".tk-row-title", "fontSize"),
      titleWeight: css(".tk-row-title", "fontWeight"),
      titleColor: css(".tk-row-title", "color"),
      saveSize: [css(".tk-row-save", "width"), css(".tk-row-save", "height")],
      descSize: css(".tk-row-desc", "fontSize"),
      descColor: css(".tk-row-desc", "color"),
      descClamp: css(".tk-row-desc", "webkitLineClamp"),
      tagSize: css(".tk-row-tag", "fontSize"),
      catColor: [css(".tk-row-tag.is-cat", "color"), css(".tk-row-tag.is-cat", "backgroundColor")],
      placeColor: [css(".tk-row-tag.is-place", "color"), css(".tk-row-tag.is-place", "backgroundColor")],
      footBorder: css(".tk-row-foot", "borderTop"),
      priceSize: price && !price.classList.contains("is-request") ? getComputedStyle(price).fontSize : null,
      priceWeight: price && !price.classList.contains("is-request") ? getComputedStyle(price).fontWeight : null,
      priceColor: price ? getComputedStyle(price).color : null,
      hasCount: Boolean(card.querySelector(".tk-row-count")),
      hasMark: Boolean(card.querySelector(".tk-row-mark")),
      // H17.1: the public card shows no views and no clicks (they stay in the seller dashboard).
      hasStats: Boolean(card.querySelector('.tk-row-stats, [data-tk="row-views"], [data-tk="row-clicks"]')),
      cardText: card.textContent ?? "",
    };
  });
}

test.describe("H14.1 listing rows", () => {
  for (const path of PAGES) {
    test(`${path}: the card matches the approved design`, async ({ page }, testInfo) => {
      await page.goto(path);
      await page.locator(ROW).first().waitFor();
      const s = await styles(page);
      expect(s.display).toBe("flex");
      expect(s.radius).toBe("16px");
      expect(s.border).toBe("1px rgb(234, 216, 240)");
      expect(s.shadow).toContain("rgba(45, 18, 72, 0.07)");
      expect(s.bodyPadding).toBe("18px 20px");
      expect(s.bodyGap).toBe("10px");
      expect(s.titleSize).toBe("18px");
      expect(s.titleWeight).toBe("700");
      expect(s.titleColor).toBe("rgb(17, 5, 32)");
      expect(s.saveSize).toEqual(["38px", "38px"]);
      expect(s.descSize).toBe("14px");
      expect(s.descColor).toBe("rgb(74, 40, 112)");
      expect(s.descClamp).toBe("2");
      expect(s.tagSize).toBe("12px");
      expect(s.catColor).toEqual(["rgb(194, 24, 91)", "rgb(253, 240, 247)"]);
      expect(s.placeColor).toEqual(["rgb(91, 33, 182)", "rgb(245, 240, 255)"]);
      expect(s.footBorder).toContain("rgb(243, 232, 247)");
      expect(s.hasCount && s.hasMark).toBe(true);
      expect(s.hasStats, "no views or clicks on a public card (H17.1)").toBe(false);
      expect(s.cardText).not.toMatch(/\b\d[\d,]*\s+(views?|clicks?)\b/i);
      if (s.priceSize) {
        expect(s.priceSize).toBe("17px");
        expect(s.priceWeight).toBe("800");
        expect(s.priceColor).toBe("rgb(194, 24, 91)");
      }
      if (isPhone(page)) {
        expect(s.direction).toBe("column");
        expect(Math.abs(s.photoWidth - s.cardWidth + 2)).toBeLessThanOrEqual(2);
        expect(Math.abs(s.photoHeight / s.photoWidth - 0.75)).toBeLessThan(0.02);
      } else {
        expect(s.direction).toBe("row");
        expect(Math.round(s.photoWidth)).toBe(200);
        // H14.1b: the photo column is 200 px wide, as tall as the card, never shorter than 200 px (no fixed 4:5).
        expect(s.photoHeight).toBeGreaterThanOrEqual(199);
        expect(Math.abs(s.photoHeight - s.cardHeight + 2)).toBeLessThanOrEqual(2);
        const listWidth = await page.locator('[data-tk="listing-grid"]').evaluate((el) => el.getBoundingClientRect().width);
        expect(listWidth).toBeLessThanOrEqual(880.5);
      }
      // #378: no placeholder text for a missing price; the tags live in the footer, after the price when there is one.
      await expect(page.locator('[data-tk="listing-grid"]').getByText("Price on request")).toHaveCount(0);
      await expect(page.locator(ROW).first().locator(".tk-row-foot .tk-row-tag.is-cat")).toHaveCount(1);
      await expect(page.locator(ROW).first().locator(".tk-row-foot .tk-row-tag.is-place")).toHaveCount(1);
      const order = await page.locator(ROW).first().evaluate((card) => {
        const price = card.querySelector('[data-tk="card-price"]');
        const tag = card.querySelector(".tk-row-tag");
        return price && tag ? price.getBoundingClientRect().left <= tag.getBoundingClientRect().left : true;
      });
      expect(order, "price first, then the tags").toBe(true);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, `list-${path.replace(/[^a-z0-9]+/gi, "_")}`, testInfo);
    });
  }

  test("rows stack one under another and the list has no sideways scroll or serious axe problem", async ({ page }) => {
    await page.goto("/dating/");
    await page.locator(ROW).first().waitFor();
    const lefts = await page.locator(ROW).evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1);
    expect(isPhone(page) || (await page.locator(ROW).first().evaluate((node) => getComputedStyle(node.parentElement!.parentElement!).rowGap))).toBeTruthy();
    const result = await new AxeBuilder({ page }).include('[data-tk="listing-grid"]').withTags(["wcag2a", "wcag2aa"]).analyze();
    const bad = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(bad.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });

  test("a hovered row lifts by 3 px; with reduced motion it does not move", async ({ page }, testInfo) => {
    test.skip(isPhone(page), "hover is a computer thing");
    await page.goto("/dating/");
    const card = page.locator(ROW).first();
    await card.waitFor();
    await card.hover();
    await expect.poll(() => card.evaluate((node) => getComputedStyle(node).transform)).toBe("matrix(1, 0, 0, 1, 0, -3)");
    await shot(page, "hover", testInfo);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.mouse.move(5, 5);
    await card.hover();
    await page.waitForTimeout(400);
    expect(await card.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
    expect(await card.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe("0s");
  });

  test("A8: a card with 2 or more photos changes slide on its own while it is on screen, and not with reduced motion", async ({ page }) => {
    test.skip(isPhone(page), "checked at 1440");
    test.setTimeout(90_000);
    const path = "/jobs/";
    await page.goto(path);
    await page.locator(ROW).first().waitFor();
    const order = await page.locator(ROW).evaluateAll((nodes) => nodes.findIndex((node) => node.querySelector(".tkh-ad-dots") !== null));
    expect(order, "a card with 2+ photos on /jobs/").toBeGreaterThanOrEqual(0);
    const card = page.locator(ROW).nth(order);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveAttribute("data-slide", "0");
    // 3 s per picture, and the first move waits 600 ms per place in the list.
    await expect(card).not.toHaveAttribute("data-slide", "0", { timeout: 3000 + 600 * Math.min(order, 6) + 1500 });

    // The same card with reduced motion: nothing moves on its own.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const still = page.locator(ROW).nth(order);
    await still.scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000 + 600 * Math.min(order, 6) + 2500);
    await expect(still).toHaveAttribute("data-slide", "0");
  });

  test("the ad page's similar ads are the same rows", async ({ page }, testInfo) => {
    await page.goto("/dating/bengaluru/");
    const href = await page.locator(`${ROW} a.tkh-ad-link`).first().getAttribute("href");
    await page.goto(href!);
    const similar = page.locator('[data-tk="similar-ads"]');
    await similar.scrollIntoViewIfNeeded();
    await expect(similar.locator(ROW).first()).toBeVisible();
    await expect(similar.locator(".tkh-ad")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "similar", testInfo);
  });
  // H14.1 (#374): the whole card is the link. One real link on the title is stretched over the card; the heart and the slider buttons sit above it.
  test("the whole row opens the ad: photo, title, description and empty space; the heart does not; one click is counted per open", async ({ page }) => {
    // Every click event the page sends (sendBeacon or fetch) is written to sessionStorage, which survives the page change.
    await page.addInitScript(() => {
      const note = (text: string) => {
        try {
          for (const event of JSON.parse(text).events ?? []) {
            if (event.type !== "click") continue;
            const list = JSON.parse(sessionStorage.getItem("h14-clicks") || "[]");
            list.push(event.slug);
            sessionStorage.setItem("h14-clicks", JSON.stringify(list));
          }
        } catch {
          /* not a count event */
        }
      };
      const beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url, data) => {
        if (String(url).includes("/api/views/") && data instanceof Blob) void data.text().then(note);
        return beacon(url, data);
      };
    });
    const clickCount = async () => (await page.evaluate(() => JSON.parse(sessionStorage.getItem("h14-clicks") || "[]").length)) as number;
    await page.goto("/jobs/mumbai/");
    const card = page.locator(ROW).first();
    await card.waitFor();
    const href = await card.locator("a.tkh-ad-link").getAttribute("href");
    expect(await card.evaluate((node) => getComputedStyle(node).cursor)).toBe("pointer");
    expect(await card.locator('a[href]:has(a), a a').count()).toBe(0);
    const spots: [string, () => ReturnType<typeof card.locator>][] = [
      ["photo", () => card.locator(".tk-row-photo")],
      ["title", () => card.locator(".tk-row-title")],
      ["description", () => card.locator(".tk-row-desc")],
      ["empty space", () => card.locator(".tk-row-foot")],
    ];
    for (const [name, target] of spots) {
      await page.goto("/jobs/mumbai/");
      const row = page.locator(ROW).first();
      await row.scrollIntoViewIfNeeded();
      const before = await clickCount();
      const box = (await target().boundingBox())!;
      // the middle of the part, but for the photo and the footer a point clear of the buttons and the counters
      // the empty space is the padding at the top of the footer, above the tags and the counters
      const x = name === "empty space" ? box.x + box.width * 0.5 : name === "photo" ? box.x + box.width * 0.5 : box.x + Math.min(box.width * 0.4, 120);
      const y = name === "photo" ? box.y + box.height * 0.4 : name === "empty space" ? box.y + 4 : box.y + box.height / 2;
      await page.mouse.click(x, y);
      await page.waitForURL(`**${href}`, { timeout: 15_000 });
      await page.waitForTimeout(800);
      expect(await clickCount(), `${name}: one click counted, not two`).toBe(before + 1);
    }
    // the heart opens nothing
    await page.goto("/jobs/mumbai/");
    const row = page.locator(ROW).first();
    await row.locator(".tk-row-save").click();
    await expect(row.locator(".tk-row-save")).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe("/jobs/mumbai/");
    await row.locator(".tk-row-save").click();
    // Tab to the title, Enter opens it, and the card shows a focus ring
    await row.locator("a.tkh-ad-link").focus();
    expect(await row.evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    await page.waitForURL(`**${href}`, { timeout: 15_000 });
  });
  // H17.1 (was #375): the public row card shows NO views and NO clicks, whatever the counters say; they stay in the seller dashboard.
  test("a row card shows no views and no clicks, and its footer fits", async ({ page }) => {
    await page.route("**/api/views/counts/**", async (route) => {
      const slugs = new URL(route.request().url()).searchParams.get("slugs")?.split(",") ?? [];
      await route.fulfill({ json: { ok: true, data: { items: Object.fromEntries(slugs.map((slug) => [slug, { views: 1248, clicks: 86 }])) } } });
    });
    await page.goto("/dating/");
    const card = page.locator(ROW).first();
    await expect(card).toBeVisible();
    await expect(card.locator('.tk-row-stats, [data-tk="row-views"], [data-tk="row-clicks"]')).toHaveCount(0);
    await expect(card).not.toContainText(/\bviews?\b|\bclicks?\b/i);
    const fit = await card.locator(".tk-row-foot").evaluate((foot) => foot.scrollWidth - foot.clientWidth);
    expect(fit, "footer scrollWidth <= clientWidth").toBeLessThanOrEqual(0);
  });
});

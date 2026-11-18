import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";

const PAGES = ["/", "/dating/", "/categories/", "/cities/", "/help/", "/search/?q=coffee"];
const SIZES = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const CHIPS = ".tkn-ls-chipline, .tkn-sr-chip, .tkn-sr-clear, .tkn-ls-clear-link, .tkn-ls-filter-btn, .tkh-ub-pill, .tkh-trust li, .h714-chips > *, .tkn-chip";

async function open(page: Page, path: string, size = SIZES[2], age = true) {
  await page.setViewportSize(size);
  await page.addInitScript((accepted) => {
    if (accepted) localStorage.setItem("nl-age", "ok");
    else localStorage.removeItem("nl-age");
    localStorage.setItem("nl-cookies", "necessary");
  }, age);
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
}

type Box = { x: number; y: number; right: number; bottom: number; height: number; width: number };
const boxOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((node): Box => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y + window.scrollY, right: rect.right, bottom: rect.bottom + window.scrollY, height: rect.height, width: rect.width };
  });

test.describe("H12.2 shared layout", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  for (const width of [390, 1440]) {
    test(`A1: no chip, button or pill text is clipped, at ${width}`, async ({ page }) => {
      test.setTimeout(120_000);
      const size = SIZES.find((entry) => entry.width === width)!;
      for (const path of PAGES) {
        await open(page, path, size);
        if (width < 600 && (await page.locator(".tkn-ls-filter-btn:visible").count())) {
          await page.locator(".tkn-ls-filter-btn:visible").first().click();
          await page.waitForTimeout(400);
        }
        const clipped = await page.locator(CHIPS).evaluateAll((nodes) => {
          const out: string[] = [];
          for (const node of nodes) {
            if (node.getClientRects().length === 0) continue;
            for (const el of [node, ...node.querySelectorAll("*")]) {
              const css = getComputedStyle(el);
              if (css.overflowX === "auto" || css.overflowX === "scroll") continue;
              if ((css.overflowX === "hidden" || css.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
                out.push(`${(el.textContent ?? "").trim().slice(0, 30)} ${el.scrollWidth}>${el.clientWidth}`);
              }
            }
          }
          return out;
        });
        expect(clipped, `${path} at ${width}`).toEqual([]);
      }
    });
  }

  test("every sideways chip row scrolls on a phone with a 24 px fade and no scrollbar, and the label reads Clear all", async ({ page }) => {
    await open(page, "/help/", SIZES[0]);
    const row = await page.locator(".h714-chips").first().evaluate((node) => {
      const css = getComputedStyle(node);
      return { overflowX: css.overflowX, snap: css.scrollSnapType, mask: css.maskImage || css.webkitMaskImage, scrollbar: css.scrollbarWidth };
    });
    expect(row.overflowX).toBe("auto");
    expect(row.snap).toContain("x");
    expect(row.mask).toContain("linear-gradient");
    expect(row.scrollbar).toBe("none");
    await open(page, "/dating/?photos=1", SIZES[0]);
    await expect(page.locator(".tkn-sr-clear").first()).toHaveText("Clear all");
  });

  test("A2: ad cards in a row end on the same line and their tag rows end on the same line", async ({ page }) => {
    for (const [path, size] of [["/dating/", SIZES[2]], ["/", SIZES[0]]] as const) {
      await open(page, path, size);
      const rows = await page.locator(".tkh-ad, .tk-row").evaluateAll((nodes) => {
        const map = new Map<number, { bottom: number; pills: number }[]>();
        for (const node of nodes) {
          const rect = node.getBoundingClientRect();
          const top = Math.round(rect.top + window.scrollY);
          const key = [...map.keys()].find((existing) => Math.abs(existing - top) < 3) ?? top;
          const pills = node.querySelector(".tkh-ad-pills")?.getBoundingClientRect();
          map.set(key, [...(map.get(key) ?? []), { bottom: rect.bottom + window.scrollY, pills: pills ? pills.bottom + window.scrollY : 0 }]);
        }
        return [...map.values()];
      });
      expect(rows.length, path).toBeGreaterThan(1);
      for (const row of rows) {
        const bottoms = row.map((card) => card.bottom);
        const pills = row.map((card) => card.pills);
        expect(Math.max(...bottoms) - Math.min(...bottoms), `${path} bottoms ${bottoms.join(",")}`).toBeLessThanOrEqual(1);
        expect(Math.max(...pills) - Math.min(...pills), `${path} tag row bottoms ${pills.join(",")}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("A3: at 390 the count has its own line, and the Filters button and the Sort select are one row of the same height", async ({ page }) => {
    await open(page, "/dating/", SIZES[0]);
    const filters = await boxOf(page, ".tkn-sr-bar .tkn-ls-filter-btn");
    const sort = await boxOf(page, ".tkn-sr-bar .tkn-sr-sort select");
    const count = await boxOf(page, ".tkn-sr-bar .tkn-sr-count");
    const heading = await boxOf(page, ".tkn-sr-h1");
    expect(Math.abs(filters.height - sort.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(filters.y - sort.y)).toBeLessThanOrEqual(2);
    expect(filters.x).toBeLessThan(sort.x);
    expect(count.bottom).toBeLessThanOrEqual(Math.min(filters.y, sort.y) + 1);
    expect(count.y).toBeGreaterThanOrEqual(heading.bottom - 1);
  });

  test("A4: at 1440 the listing grid ends inside the header on the right (880 px list)", async ({ page }) => {
    for (const path of ["/dating/", "/search/?q=coffee"]) {
      await open(page, path, SIZES[2]);
      const header = await boxOf(page, ".tkn-sr-head");
      const grid = await boxOf(page, ".tkn-grid");
      // H14.1: the approved design caps the list of row cards at 880 px, so it ends at or before the header's right edge.
      expect(grid.right, `${path}: grid ${grid.right} header ${header.right}`).toBeLessThanOrEqual(header.right + 2);
      expect(grid.width, `${path}: list width`).toBeLessThanOrEqual(880.5);
    }
  });

  test("A5: the 18+ pop-up focuses the enter button, its title is weight 600 and the Terms link ring follows the text", async ({ page }) => {
    await open(page, "/", SIZES[2], false);
    await expect(page.locator('[data-tk="age-gate"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-tk"))).toBe("age-accept");
    expect(await page.locator("#age-title").evaluate((node) => parseInt(getComputedStyle(node).fontWeight, 10))).toBeGreaterThanOrEqual(600);
    const terms = await page.locator(".tk-age-terms").evaluate((node) => {
      const css = getComputedStyle(node);
      return { display: css.display, decoration: css.getPropertyValue("box-decoration-break") };
    });
    expect(terms.display).toBe("inline");
    expect(terms.decoration).toBe("clone");
  });

  test("A6: at 390 the chat button is 48 px, 16 px from the edges, and never covers the last ad card", async ({ page }) => {
    await open(page, "/dating/", SIZES[0]);
    const bubble = await page.locator(".tkn-chat-bubble").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height, right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom };
    });
    expect(Math.round(bubble.width)).toBe(48);
    expect(Math.round(bubble.height)).toBe(48);
    expect(Math.round(bubble.right)).toBe(16);
    expect(Math.round(bubble.bottom)).toBe(16);
    expect(parseFloat(await page.evaluate(() => getComputedStyle(document.body).paddingBottom))).toBeGreaterThanOrEqual(72);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const clash = await page.evaluate(() => {
      const bubbleRect = document.querySelector(".tkn-chat-bubble")!.getBoundingClientRect();
      const cards = [...document.querySelectorAll(".tkh-ad, .tk-row")];
      const last = cards[cards.length - 1]?.getBoundingClientRect();
      if (!last) return false;
      return !(last.right < bubbleRect.left || last.left > bubbleRect.right || last.bottom < bubbleRect.top || last.top > bubbleRect.bottom);
    });
    expect(clash).toBe(false);
  });

  test("search boxes: one row from 768 up with input and button the same height, a full-width button under the input on a phone", async ({ page }) => {
    for (const path of ["/categories/", "/cities/", "/help/"]) {
      await open(page, path, SIZES[1]);
      let input = await boxOf(page, '.h714-search label');
      let button = await boxOf(page, ".h714-search-go");
      expect(Math.abs(input.y + input.height / 2 - (button.y + button.height / 2)), `${path} at 768`).toBeLessThanOrEqual(2);
      expect(Math.abs(input.height - button.height), `${path} heights`).toBeLessThanOrEqual(1);
      await open(page, path, SIZES[0]);
      input = await boxOf(page, ".h714-search label");
      button = await boxOf(page, ".h714-search-go");
      expect(button.y, `${path} at 390`).toBeGreaterThan(input.bottom - 1);
      expect(Math.abs(button.width - input.width), `${path} width`).toBeLessThanOrEqual(2);
    }
  });

  test("item 5: at 1440 the top strip crawl moves and fades at both ends", async ({ page }) => {
    await open(page, "/", SIZES[2]);
    const crawl = page.locator('[data-tk="top-bar-crawl"]');
    await expect(crawl).toBeVisible();
    const mask = await crawl.evaluate((node) => getComputedStyle(node).maskImage || getComputedStyle(node).webkitMaskImage);
    expect(mask).toContain("linear-gradient");
    expect(mask).toContain("24px");
    const offset = () => page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('[data-tk="top-bar-crawl"] > div')!).transform).m41);
    const first = await offset();
    await page.waitForTimeout(1000);
    expect(await offset()).toBeLessThan(first);
  });

  test("item 5: with reduced motion the strip is still and no item is clipped or cut", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: SIZES[2], reducedMotion: "reduce" });
    await context.addInitScript(() => {
      localStorage.setItem("nl-age", "ok");
      localStorage.setItem("nl-cookies", "necessary");
    });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    const crawl = page.locator('[data-tk="top-bar-crawl"]');
    const before = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('[data-tk="top-bar-crawl"] > div')!).transform).m41);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('[data-tk="top-bar-crawl"] > div')!).transform).m41)).toBe(before);
    const shown = await crawl.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const items = [...node.querySelectorAll(".tkh-ub-set:first-child .tkh-ub-item")];
      const inside = items.filter((item) => {
        const rect = item.getBoundingClientRect();
        return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1 && rect.left >= box.left - 1 && rect.right <= box.right + 1;
      });
      const partly = items.filter((item) => {
        const rect = item.getBoundingClientRect();
        const visible = rect.bottom > box.top && rect.top < box.bottom && rect.right > box.left && rect.left < box.right;
        return visible && !inside.includes(item);
      });
      return { inside: inside.length, partly: partly.length, mask: getComputedStyle(node).maskImage };
    });
    expect(shown.inside).toBeGreaterThanOrEqual(1);
    expect(shown.partly).toBe(0);
    expect(shown.mask).toBe("none");
    await context.close();
  });

  test("A7: no sideways scroll on the 6 pages at 390, 768 and 1440", async ({ page }) => {
    test.setTimeout(180_000);
    for (const size of SIZES) {
      for (const path of PAGES) {
        await open(page, path, size);
        expect(await hasHorizontalScroll(page), `${path} at ${size.width}`).toBe(false);
      }
    }
  });
});

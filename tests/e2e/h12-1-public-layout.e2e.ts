import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";

const PAGES: [string, string][] = [
  ["home", "/"],
  ["categories", "/categories/"],
  ["cities", "/cities/"],
  ["blog", "/blog/"],
  ["contact", "/contact/"],
  ["how-it-works", "/how-it-works/"],
  ["safety", "/safety/"],
  ["zzz-404", "/zzz-404/"],
];
const SIZES = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const TILE_PAGES = ["/", "/categories/", "/cities/"];
const TILE = ".tkh-cats > li > a, a.h714-cat";
const TILE_ARROW = ".tkh-cat-arrow, .h714-arrow";
const TILE_NAME = ".tkh-cat-name, .h714-name";
const SHOTS = process.env.H121_SHOTS ?? "";

async function open(page: Page, path: string, size = SIZES[2]) {
  await page.setViewportSize(size);
  await page.addInitScript(() => {
    localStorage.setItem("nl-age", "ok");
    localStorage.setItem("nl-cookies", "necessary");
  });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
}

test.describe("H12.1 public pages layout", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("A1: /safety/ is a styled page with one h1, at least 3 h2 and body text of 15 px or more, and still has the Report a listing link", async ({ page }) => {
    await open(page, "/safety/");
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.locator("main h2, article h2").count()).toBeGreaterThanOrEqual(3);
    const sizes = await page.locator("article p").evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
    expect(sizes.length).toBeGreaterThanOrEqual(5);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(15);
    await expect(page.getByRole("link", { name: "Report a listing" })).toHaveAttribute("href", /scam-report/);
  });

  test("A2: the words Video call photo never show on /how-it-works/", async ({ page }) => {
    for (const size of SIZES) {
      await open(page, "/how-it-works/", size);
      expect(await page.locator("body").innerText()).not.toContain("Video call photo");
      expect(await page.locator("[aria-hidden='true']").filter({ hasText: "Video call photo" }).count()).toBe(0);
    }
  });

  for (const width of [390, 1440]) {
    test(`A3: tiles in a row are the same height with the arrow in the same place, at ${width}`, async ({ page }) => {
      const size = SIZES.find((entry) => entry.width === width)!;
      for (const path of TILE_PAGES) {
        await open(page, path, size);
        const tiles = await page.locator(TILE).evaluateAll(
          (nodes, arrowSelector) =>
            nodes.map((node) => {
              const box = node.getBoundingClientRect();
              const arrow = node.querySelector(arrowSelector as string)?.getBoundingClientRect();
              return { top: Math.round(box.top + window.scrollY), height: box.height, arrow: arrow ? arrow.top - box.top : null };
            }),
          TILE_ARROW,
        );
        expect(tiles.length, path).toBeGreaterThan(1);
        const rows = new Map<number, typeof tiles>();
        for (const tile of tiles) {
          const key = [...rows.keys()].find((top) => Math.abs(top - tile.top) <= 2) ?? tile.top;
          rows.set(key, [...(rows.get(key) ?? []), tile]);
        }
        for (const [top, row] of rows) {
          const heights = row.map((tile) => tile.height);
          expect(Math.max(...heights) - Math.min(...heights), `${path} row at ${top}: heights ${heights.join(",")}`).toBeLessThanOrEqual(1);
          const arrows = row.map((tile) => tile.arrow);
          expect(arrows.every((value) => value !== null), `${path} row at ${top}: every tile has an arrow`).toBe(true);
          const values = arrows as number[];
          expect(Math.max(...values) - Math.min(...values), `${path} row at ${top}: arrows ${values.join(",")}`).toBeLessThanOrEqual(1);
        }
      }
    });
  }

  test("A4: no tile title or city name is split across two lines in the middle of a word, at 390", async ({ page }) => {
    for (const path of TILE_PAGES) {
      await open(page, path, SIZES[0]);
      const split = await page.locator(`${TILE_NAME}, .tk-city-row`).evaluateAll((nodes) => {
        const broken: string[] = [];
        for (const node of nodes) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          for (let text = walker.nextNode(); text; text = walker.nextNode()) {
            const value = text.nodeValue ?? "";
            for (const match of value.matchAll(/\S+/g)) {
              const range = document.createRange();
              range.setStart(text, match.index ?? 0);
              range.setEnd(text, (match.index ?? 0) + match[0].length);
              const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
              if (tops.size > 1) broken.push(match[0]);
            }
          }
        }
        return broken;
      });
      expect(split, path).toEqual([]);
    }
  });

  test("A5: every h1, h2 and h3 on the 8 pages is weight 600 or more", async ({ page }) => {
    for (const [name, path] of PAGES) {
      for (const size of [SIZES[0], SIZES[2]]) {
        await open(page, path, size);
        const light = await page.locator("h1, h2, h3").evaluateAll((nodes) =>
          nodes
            .filter((node) => node.getClientRects().length > 0)
            .map((node) => ({ text: (node.textContent ?? "").trim().slice(0, 40), weight: parseInt(getComputedStyle(node).fontWeight, 10) }))
            .filter((entry) => entry.weight < 600),
        );
        expect(light, `${name} at ${size.width}`).toEqual([]);
      }
    }
  });

  test("A6: no sideways scroll on the 8 pages at 390, 768 and 1440", async ({ page }) => {
    test.setTimeout(180_000);
    for (const size of SIZES) {
      for (const [name, path] of PAGES) {
        await open(page, path, size);
        expect(await hasHorizontalScroll(page), `${name} at ${size.width}`).toBe(false);
        if (SHOTS) {
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: `${SHOTS}/${name}-${size.width}.png`, fullPage: true });
        }
      }
    }
  });

  test("the 404 page lets Latest ads in India wrap, and every list header has the title left and the link on its right", async ({ page }) => {
    await open(page, "/zzz-404/", SIZES[0]);
    const heading = page.locator("#latest-ads");
    await expect(heading).toBeVisible();
    const style = await heading.evaluate((node) => {
      const css = getComputedStyle(node);
      return { overflow: css.overflow, textOverflow: css.textOverflow, wrap: css.whiteSpace, fits: node.scrollWidth <= node.clientWidth + 1 };
    });
    expect(style.textOverflow).not.toBe("ellipsis");
    expect(style.wrap).not.toBe("nowrap");
    expect(style.fits).toBe(true);

    await open(page, "/", SIZES[2]);
    const heads = await page.locator(".tkh-head:has(a)").evaluateAll((nodes) =>
      nodes.map((head) => {
        const baseline = (element: Element) => {
          const probe = document.createElement("span");
          probe.style.cssText = "display:inline-block;width:0;height:0";
          element.appendChild(probe);
          const bottom = probe.getBoundingClientRect().bottom;
          probe.remove();
          return bottom;
        };
        const title = head.querySelector("h2")!;
        const link = head.querySelector("a")!;
        return { titleRight: title.getBoundingClientRect().right, linkLeft: link.getBoundingClientRect().left, titleBase: baseline(title), linkBase: baseline(link) };
      }),
    );
    expect(heads.length).toBeGreaterThanOrEqual(2);
    for (const head of heads) {
      expect(head.linkLeft).toBeGreaterThan(head.titleRight - 1);
      expect(Math.abs(head.linkBase - head.titleBase)).toBeLessThanOrEqual(1);
    }
  });

  test("blog cards: no empty cover box, one Read article link on every card", async ({ page }) => {
    for (const size of [SIZES[0], SIZES[2]]) {
      await open(page, "/blog/", size);
      const empty = await page.locator(".tkp-feature-cover, .tkp-post-cover, .tkp-cover").evaluateAll((nodes) =>
        nodes.filter((node) => node.getClientRects().length > 0 && !node.querySelector("img, svg")).map((node) => node.className),
      );
      expect(empty).toEqual([]);
      const labels = await page.locator(".tkp-read, .tkp-post-more").allInnerTexts();
      expect(new Set(labels.map((label) => label.trim())).size).toBeLessThanOrEqual(1);
    }
  });
});

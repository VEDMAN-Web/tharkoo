import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, isPhone, test } from "./helpers";

/** H14.1b: the horizontal hover pop-out of a listing row (A4, A5, A6), and the row's photo column. */

const SHOTS = process.env.H14_SHOTS_DIR || join(process.cwd(), ".shots", "H14.1b");
const ROW = '[data-tk="listing-row"]';
const POP = '[data-tk="listing-popout"]';
const FEED = "/jobs/mumbai/";

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

/** Marks the moment the pointer enters a row and the moment a pop-out is added to the page, and adds up layout shifts. */
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __enter?: number; __open?: number; __cls?: number };
    w.__enter = undefined;
    w.__open = undefined;
    w.__cls = 0;
    document.addEventListener("pointerenter", (event) => (event.target as Element)?.matches?.('[data-tk="listing-row"]') && (w.__enter ??= performance.now()), true);
    new MutationObserver(() => {
      if (document.querySelector('[data-tk="listing-popout"]')) w.__open ??= performance.now();
    }).observe(document.body, { childList: true, subtree: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) w.__cls = (w.__cls ?? 0) + shift.value;
      }
    }).observe({ type: "layout-shift", buffered: false });
  });
}

test.describe("H14.1b row pop-out", () => {
  test.beforeEach(({ page }) => {
    test.skip(isPhone(page), "the pop-out is for a computer; the phone has none (checked below)");
  });

  test("A4: hovering a row opens the pop-out within 300 ms, inside the window, with no layout shift; Esc and leaving close it", async ({ page }) => {
    await page.goto(FEED);
    const row = page.locator(ROW).nth(1);
    await row.waitFor();
    await row.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await watch(page);
    await row.hover();
    const pop = page.locator(POP);
    await expect(pop).toBeVisible({ timeout: 2000 });
    const times = await page.evaluate(() => {
      const w = window as unknown as { __enter?: number; __open?: number; __cls?: number };
      return { delay: (w.__open ?? 0) - (w.__enter ?? 0), cls: w.__cls ?? 0 };
    });
    expect(times.delay, "pop-out within 300 ms of the pointer entering").toBeLessThanOrEqual(300);
    expect(times.cls, "layout shift").toBeLessThan(0.0001);
    const box = (await pop.boundingBox())!;
    const view = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height);
    expect(box.width, "wider than the row").toBeGreaterThan((await row.boundingBox())!.width - 1);
    const sideways = await pop.evaluate((node) => {
      const photo = node.querySelector(".tkh-pop-photo")!.getBoundingClientRect();
      const body = node.querySelector(".tk-pop-body")!.getBoundingClientRect();
      return photo.right <= body.left + 1 && Math.abs(photo.top - body.top) < 2;
    });
    expect(sideways, "photo on the left, text on the right").toBe(true);
    await expect(pop.locator(".tk-pop-desc")).toBeVisible();
    await expect(pop.locator(".tk-row-tag.is-cat")).toBeVisible();
    await expect(pop.getByRole("button", { name: /Save ad|Saved/ })).toBeVisible();
    await expect(pop.getByText("View ad")).toHaveCount(0);
    await shot(page, `row-popout-${page.viewportSize()!.width}`);

    await page.keyboard.press("Escape");
    await expect(pop).toHaveCount(0);
    await page.mouse.move(2, 2);
    await row.hover();
    await expect(pop).toBeVisible();
    await page.mouse.move(2, 2);
    await expect(pop).toHaveCount(0);
  });

  test("the whole pop-out opens the ad with one click event; Save does not open it", async ({ page }) => {
    await page.addInitScript(() => {
      const beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url, data) => {
        if (String(url).includes("/api/views/") && data instanceof Blob) {
          void data.text().then((text) => {
            try {
              for (const event of JSON.parse(text).events ?? []) {
                if (event.type !== "click") continue;
                const list = JSON.parse(sessionStorage.getItem("h14b-clicks") || "[]");
                list.push(event.slug);
                sessionStorage.setItem("h14b-clicks", JSON.stringify(list));
              }
            } catch {
              /* not a count event */
            }
          });
        }
        return beacon(url, data);
      };
    });
    await page.goto(FEED);
    const row = page.locator(ROW).nth(1);
    await row.scrollIntoViewIfNeeded();
    const href = await row.locator("a.tkh-ad-link").getAttribute("href");
    await page.mouse.move(2, 2);
    await row.hover();
    const pop = page.locator(POP);
    await expect(pop).toBeVisible();
    const save = pop.getByRole("button", { name: /Save ad|Saved/ });
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true");
    expect(new URL(page.url()).pathname).toBe(FEED);
    await save.click();
    const before = (await page.evaluate(() => JSON.parse(sessionStorage.getItem("h14b-clicks") || "[]").length)) as number;
    const text = (await pop.locator(".tk-pop-desc").boundingBox())!;
    await page.mouse.click(text.x + text.width / 2, text.y + text.height / 2);
    await page.waitForURL(`**${href}`, { timeout: 15_000 });
    await page.waitForTimeout(800);
    const after = (await page.evaluate(() => JSON.parse(sessionStorage.getItem("h14b-clicks") || "[]").length)) as number;
    expect(after - before, "one click event for the open").toBe(1);
  });

  test("A6: with reduced motion the pop-out does not animate and the row does not move", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(FEED);
    const row = page.locator(ROW).nth(1);
    await row.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await row.hover();
    const pop = page.locator(POP);
    await expect(pop).toBeVisible();
    expect(await pop.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
    expect(await row.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  });

  test("with motion the pop-out grows with scale and opacity only", async ({ page }) => {
    await page.goto(FEED);
    const row = page.locator(ROW).nth(1);
    await row.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await row.hover();
    const pop = page.locator(POP);
    await expect(pop).toBeVisible();
    const animated = await pop.evaluate((node) => {
      const name = getComputedStyle(node).animationName;
      const rule = [...document.styleSheets].flatMap((sheet) => {
        try {
          return [...sheet.cssRules];
        } catch {
          return [];
        }
      }).find((css) => css instanceof CSSKeyframesRule && css.name === name) as CSSKeyframesRule | undefined;
      return rule ? [...rule.cssRules].flatMap((frame) => [...(frame as CSSKeyframeRule).style]) : [];
    });
    expect(animated.length).toBeGreaterThan(0);
    expect(animated.every((prop) => prop === "opacity" || prop === "transform")).toBe(true);
  });
});

test.describe("H14.1b row pop-out on touch and phone", () => {
  test("A5: a touch screen never shows the pop-out", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, hasTouch: true, isMobile: true, viewport: { width: 1024, height: 800 } });
    await context.addInitScript(() => {
      localStorage.setItem("nl-age", "ok");
      localStorage.setItem("nl-cookies", "necessary");
    });
    const page = await context.newPage();
    await page.goto(FEED);
    const row = page.locator(ROW).nth(1);
    await row.waitFor();
    await row.scrollIntoViewIfNeeded();
    const box = (await row.locator(".tk-row-desc").boundingBox())!;
    await page.touchscreen.tap(box.x + 4, box.y - 6);
    await page.waitForTimeout(700);
    await expect(page.locator(POP)).toHaveCount(0);
    await context.close();
  });

  test("a phone width shows no pop-out even with a mouse", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FEED);
    const row = page.locator(ROW).nth(1);
    await row.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await row.hover();
    await page.waitForTimeout(600);
    await expect(page.locator(POP)).toHaveCount(0);
  });
});

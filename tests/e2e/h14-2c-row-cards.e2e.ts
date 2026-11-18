import type { Locator, Page } from "@playwright/test";
import { expect, firstAdPath, loginUi, newUserApi, test } from "./helpers";

/**
 * H14.2 part 3: the row cards of the four ad lists (listing pages, similar ads, the 404 page, Fresh ads on the panel) are whole-card links.
 * On each: the photo, the title, the description and the empty space open the ad with one click event; the heart does not.
 */

const ROW = '[data-tk="listing-row"]';

/** Click events the page sends, written down inside the page so they survive the page change. */
async function watchClicks(page: Page) {
  await page.addInitScript(() => {
    const note = (body: unknown) => {
      void (async () => {
        const text = body instanceof Blob ? await body.text() : String(body ?? "");
        const found = (text.match(/"type":"click"/g) ?? []).length;
        if (found) localStorage.setItem("__clicks", String(Number(localStorage.getItem("__clicks") ?? "0") + found));
      })();
    };
    const beacon = navigator.sendBeacon?.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (String(url).includes("/api/views/")) note(data);
      return beacon ? beacon(url, data) : false;
    };
  });
  return async () => Number(await page.evaluate(() => localStorage.getItem("__clicks") ?? "0"));
}

async function middle(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Runs the whole-card checks on the first row found by `rows` at the page's current address, coming back with Back after each open.
 * `again` loads the list again after Back when the page does not keep it.
 */
async function checkRows(page: Page, rows: () => Locator, clicks: () => Promise<number>, name: string) {
  const here = page.url();
  const first = () => rows().first();
  await first().scrollIntoViewIfNeeded();
  await expect(first()).toBeVisible();
  await expect(page.getByText("View ad", { exact: true })).toHaveCount(0);
  expect(await first().evaluate((node) => getComputedStyle(node).cursor), `${name}: pointer cursor`).toBe("pointer");

  // The heart saves; it does not open the ad.
  const heart = first().locator(".tk-row-save");
  await heart.click();
  expect(page.url(), `${name}: the heart does not open the ad`).toBe(here);
  await heart.click();

  const targets: [string, () => Locator][] = [
    ["photo", () => first().locator(".tk-row-photo")],
    ["title", () => first().locator(".tkh-ad-link")],
    ["description", () => first().locator(".tk-row-desc")],
    ["stats (empty space)", () => first().locator(".tk-row-stats")],
  ];
  for (const [label, target] of targets) {
    if ((await target().count()) === 0) continue;
    await first().scrollIntoViewIfNeeded();
    const before = await clicks();
    await middle(page, target());
    await expect(page, `${name}: ${label} opens the ad`).toHaveURL(/\/ad\//);
    await page.waitForTimeout(400);
    expect((await clicks()) - before, `${name}: one click event when opening from the ${label}`).toBe(1);
    await page.goBack();
    await page.waitForLoadState("networkidle");
    await first().scrollIntoViewIfNeeded();
    await expect(first()).toBeVisible();
  }
}

test.describe("H14.2c the row cards are whole-card links on all four lists", () => {
  test("listing page", async ({ page }) => {
    test.setTimeout(240_000);
    const clicks = await watchClicks(page);
    await page.goto("/dating/bengaluru/");
    await page.waitForLoadState("networkidle");
    await checkRows(page, () => page.locator(`[data-tk="listing-grid"] ${ROW}`), clicks, "listing page");
  });

  test("similar ads on an ad page", async ({ page }) => {
    test.setTimeout(240_000);
    const clicks = await watchClicks(page);
    const adPath = await firstAdPath(page);
    await page.goto(adPath);
    await page.waitForLoadState("networkidle");
    await checkRows(page, () => page.locator(`[data-tk="similar-ads"] ${ROW}`), clicks, "similar ads");
  });

  test("the 404 page", async ({ page }) => {
    test.setTimeout(240_000);
    const clicks = await watchClicks(page);
    await page.goto("/there-is-no-such-page-h142c/");
    await page.waitForLoadState("networkidle");
    await checkRows(page, () => page.locator(ROW), clicks, "404 page");
  });

  test("Fresh ads on the panel", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const clicks = await watchClicks(page);
    const user = await newUserApi(baseURL!, "h142cfresh");
    await loginUi(page, user.email, undefined, "/u/account/messages/");
    await page.waitForLoadState("networkidle");
    await checkRows(page, () => page.locator(`[data-tk="discover"] ${ROW}`), clicks, "fresh ads");
    await user.api.dispose();
  });
});

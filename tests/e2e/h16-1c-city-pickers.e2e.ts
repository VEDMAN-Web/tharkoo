import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test, withLocalDb } from "./helpers";

/**
 * H16.1c: with about 900 cities the pick lists for a city are a type-ahead box that shows only the best matches, never a giant list.
 * 905 test cities are put in the LOCAL database for this file and removed again. The shared city list is cached for up to a minute,
 * so the file waits until the site shows (or no longer shows) the test cities.
 */

const TAG = "h161c";
const COUNT = 905;
const SHOTS = join(process.cwd(), ".shots", "H16.1c");

test.describe.configure({ mode: "serial" });

/** The cache of the city list is kept for 60 seconds, so pages built on the server see a change up to a minute after the database. */
const CACHE_WAIT_MS = 65_000;

/** After the minute is over the first page still gets the old list while the new one is fetched, so ask once, wait a moment, and then it is fresh. */
async function settle(api: APIRequestContext) {
  await new Promise((resolve) => setTimeout(resolve, CACHE_WAIT_MS));
  await api.get("/cities/");
  await new Promise((resolve) => setTimeout(resolve, 6000));
}

async function cityCount(api: APIRequestContext) {
  const res = await api.get("/api/locations?type=city");
  const body = (await res.json()) as { data: { locations: { slug: string }[] } };
  return body.data.locations.filter((item) => item.slug.startsWith(`${TAG}-`)).length;
}

async function seed() {
  await withLocalDb(async (db) => {
    const states = await db.collection("locations").find({ type: "state", slug: { $in: ["gujarat", "maharashtra"] } }).toArray();
    const now = new Date();
    const rows = Array.from({ length: COUNT }, (_, index) => ({
      type: "city",
      slug: `${TAG}-town-${String(index).padStart(3, "0")}`,
      name: `H161c Town ${String(index).padStart(3, "0")}`,
      parentId: states[index % states.length]._id,
      enabled: true,
      order: 500 + index,
      countryCode: "IN",
      createdAt: now,
      updatedAt: now,
    }));
    // Two places with the same name in two states: the list must tell them apart.
    rows.push({ ...rows[0], slug: `${TAG}-twin-a`, name: "H161c Twin", parentId: states[0]._id });
    rows.push({ ...rows[0], slug: `${TAG}-twin-b`, name: "H161c Twin", parentId: states[1]._id });
    await db.collection("locations").insertMany(rows);
  });
}

async function remove() {
  await withLocalDb((db) => db.collection("locations").deleteMany({ slug: { $regex: `^${TAG}-` } }));
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}-${page.viewportSize()?.width}.png`) });
}

/** The list shows at most 40 matches, fits in the screen, and the page has no sideways scroll. */
async function checkList(page: Page, box: ReturnType<Page["locator"]>) {
  const list = page.locator('[data-tk="search-select-list"]');
  await expect(list).toBeVisible();
  const shown = await list.getByRole("option").count();
  expect(shown, "never the whole list").toBeLessThanOrEqual(40);
  expect(shown).toBeGreaterThan(0);
  const view = page.viewportSize()!;
  const edge = (await list.boundingBox())!;
  expect(edge.height, "the list is shorter than half the screen").toBeLessThanOrEqual(view.height * 0.5);
  expect(edge.x).toBeGreaterThanOrEqual(0);
  expect(edge.x + edge.width).toBeLessThanOrEqual(view.width);
  const tap = (await list.getByRole("option").first().boundingBox())!;
  expect(tap.height, "a row is tall enough to tap").toBeGreaterThanOrEqual(40);
  expect(await hasHorizontalScroll(page)).toBe(false);
  await expect(box).toHaveAttribute("aria-expanded", "true");
}

test.describe("H16.1c city pickers with about 900 cities", () => {
  test.beforeAll(async ({ baseURL, playwright }) => {
    test.setTimeout(240_000);
    await seed();
    const api = await playwright.request.newContext({ baseURL });
    await expect.poll(() => cityCount(api), { timeout: 150_000, intervals: [3000] }).toBeGreaterThan(COUNT);
    await api.dispose();
  });

  test.afterAll(async ({ baseURL, playwright }) => {
    test.setTimeout(240_000);
    await remove();
    const api = await playwright.request.newContext({ baseURL });
    await expect.poll(() => cityCount(api), { timeout: 150_000, intervals: [3000] }).toBe(0);
    await settle(api);
    await api.dispose();
  });

  test("the search pop-up: the city box is a type-ahead, shows the best matches, and picking one sets the city", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const modal = page.locator("[data-tk=search-modal]");
    await expect(async () => {
      await page.evaluate(() => window.dispatchEvent(new Event("tk-open-search")));
      await expect(modal).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    const box = modal.locator('input[data-tk="search-city"]');
    await expect(box, "a long list is a text box, not a select").toBeVisible();
    await expect(modal.locator('select[data-tk="search-city"]')).toHaveCount(0);

    await box.click();
    await checkList(page, box);
    await box.fill("h161c town 04");
    const options = page.locator('[data-tk="search-select-list"]').getByRole("option");
    await expect(options.first()).toContainText("H161c Town 040");
    expect(await options.count()).toBe(10);
    await shot(page, "search-modal");
    await options.nth(3).click();
    await expect(box).toHaveValue("H161c Town 043");
    await modal.locator("[data-tk=search-category]").getByRole("button").first().click();
    await modal.locator("[data-tk=search-submit]").click();
    await expect(page).toHaveURL(/h161c-town-043/);

    // Typing something that matches nothing says so, and Escape puts the old choice back.
    await page.goto("/");
    await expect(async () => {
      await page.evaluate(() => window.dispatchEvent(new Event("tk-open-search")));
      await expect(modal).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    await box.fill("zzzqqq");
    await expect(page.locator('[data-tk="search-select-list"]')).toContainText("No city matches");
    await box.press("Escape");
    await expect(box).toHaveValue("");
  });

  test("the post-ad form: the city is a type-ahead, two places with one name show their state, and the keyboard picks", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const user = await newUserApi(baseURL!, "h161cpost");
    await loginUi(page, user.email, undefined, "/u/post-insert/");
    const box = page.locator("input#city");
    // The form is built on the server from a city list that is kept for a minute, so open it again until it has the new cities.
    await expect(async () => {
      await page.goto("/u/post-insert/");
      await page.locator(".tkp-tile", { hasText: "Dating" }).click();
      await page.locator("[data-tk=go-on]").click();
      await expect(box).toBeVisible({ timeout: 6000 });
    }).toPass({ timeout: 170_000, intervals: [10_000] });
    await expect(page.locator("select#city")).toHaveCount(0);

    await box.click();
    await checkList(page, box);
    await box.fill("H161c Twin");
    const options = page.locator('[data-tk="search-select-list"]').getByRole("option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toContainText(/Gujarat|Maharashtra/);
    await expect(options.nth(1)).toContainText(/Gujarat|Maharashtra/);
    await shot(page, "post-ad");

    await box.fill("h161c town 9");
    await box.press("ArrowDown");
    await box.press("Enter");
    await expect(box).toHaveValue("H161c Town 901");
    await box.press("Tab");
    await expect(box).toHaveValue("H161c Town 901");
    await expect(page.locator('[data-tk="search-select-list"]')).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await user.api.dispose();
  });

  test("the alerts page: the city box is a type-ahead and a saved alert keeps the picked city", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const user = await newUserApi(baseURL!, "h161calert");
    await loginUi(page, user.email, undefined, "/u/account/alerts/");
    const form = page.locator('section[aria-labelledby="alerts-new"] form');
    const box = form.locator("input#alert-city");
    await expect(async () => {
      await page.goto("/u/account/alerts/");
      await expect(box).toBeVisible({ timeout: 6000 });
    }).toPass({ timeout: 170_000, intervals: [10_000] });
    await box.fill("h161c town 12");
    await page.locator('[data-tk="search-select-list"]').getByRole("option").first().click();
    await expect(box).toHaveValue("H161c Town 120");
    await form.getByLabel("Words").fill("h161c desk");
    await form.getByRole("button", { name: "Save search" }).click();
    await expect(page.getByText("Alert saved. We will email you when a new ad matches.")).toBeVisible();
    await expect(page.locator('section[aria-labelledby="alerts-list"]')).toContainText("H161c Town 120");
    await expect(box, "the form is cleared").toHaveValue("");
    await user.api.dispose();
  });
});

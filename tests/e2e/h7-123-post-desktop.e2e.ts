import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, grantCredits, hasHorizontalScroll, newUserApi, originHeaders, test, USER_PASSWORD } from "./helpers";

const SHOTS = process.env.H7123_SHOTS_DIR || "";
const TAG = process.env.H7123_TAG || "after";
const TALL: [number, number][] = [
  [1920, 912],
  [1536, 864],
  [1440, 900],
];
const SHORT: [number, number][] = [
  [1366, 768],
  [1536, 674],
];
const STEPS = ["1", "2", "3", "5"];

async function draftFor(page: Page, baseURL: string, slug: string) {
  const user = await newUserApi(baseURL, `wide-${slug}`);
  const login = await page.request.post("/api/auth/login", { headers: originHeaders(baseURL, "/u/login/"), data: { email: user.email, password: USER_PASSWORD } });
  expect(login.status()).toBe(200);
  await grantCredits(page, 100);
  const saved = await page.request.put("/api/auth/seller-profile", {
    headers: originHeaders(baseURL, "/u/seller-profile/"),
    data: { name: "Asha", city: "Mumbai", whatsapp: "", availableNow: false },
  });
  expect(saved.status(), await saved.text()).toBe(200);
  const categories = (await (await user.api.get("/api/categories")).json()).data.categories as { _id: string; slug: string }[];
  const cities = (await (await user.api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const category = categories.find((item) => item.slug === slug);
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  expect(category, `category ${slug}`).toBeTruthy();
  const created = await page.request.post("/api/listings", {
    headers: originHeaders(baseURL, "/u/post-insert/"),
    data: { categoryId: category!._id, cityId: city.id, title: "Warm and friendly company", description: "A friendly description of the ad that is long enough to pass the check." },
  });
  expect(created.status(), await created.text()).toBe(201);
  const id = ((await created.json()).data as { id: string }).id;
  await user.api.dispose();
  return id;
}

async function openStep(page: Page, id: string, step: string) {
  await page.goto(`/u/post-insert/?draft=${id}&step=${step}`);
  await expect(page.locator(".tkp-main[data-step]")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

async function boxes(page: Page) {
  return page.evaluate(() => {
    const pick = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width };
    };
    return { rail: pick(".tkp-rail"), main: pick(".tkp-main"), aside: pick(".tkp-aside"), height: window.innerHeight, extra: document.documentElement.scrollHeight - window.innerHeight };
  });
}

test.describe("H7.123 post-ad wizard on a big desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  test("shots of steps 1, 2, 3 and 5 at every size", async ({ page, baseURL }) => {
    test.skip(!SHOTS, "set H7123_SHOTS_DIR to take shots");
    test.setTimeout(300_000);
    mkdirSync(SHOTS, { recursive: true });
    const id = await draftFor(page, baseURL!, "dating");
    for (const [width, height] of [...TALL, ...SHORT, [390, 844]] as [number, number][]) {
      await page.setViewportSize({ width, height });
      for (const step of STEPS) {
        await openStep(page, id, step);
        await page.screenshot({ path: `${SHOTS}/${TAG}-step${step}-${width}x${height}.png` });
      }
    }
  });

  test("on a tall desktop the three columns share one top and the step card keeps one width", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const id = await draftFor(page, baseURL!, "dating");
    for (const [width, height] of TALL) {
      await page.setViewportSize({ width, height });
      const widths = new Set<number>();
      for (const step of STEPS) {
        await openStep(page, id, step);
        const found = await boxes(page);
        const label = `step ${step} at ${width}x${height}`;
        // H21.0 (spec rule 4): only the page scrolls, so the page-height and in-view checks no longer apply.
        expect(Math.abs(found.rail!.top - found.main!.top), `${label}: rail top`).toBeLessThanOrEqual(2);
        expect(Math.abs(found.aside!.top - found.main!.top), `${label}: preview top`).toBeLessThanOrEqual(2);
        widths.add(Math.round(found.main!.width));
        await expect(page.locator("[data-tk=exit-post]")).toBeVisible();
        await expect(page.locator("[data-tk=draft-saved]")).toHaveCount(1);
      }
      expect(widths.size, `${width}x${height}: the step card keeps one width`).toBe(1);
    }
  });

  test("tap targets are 44 px and the page passes axe on a tall desktop", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const id = await draftFor(page, baseURL!, "dating");
    await page.setViewportSize({ width: 1920, height: 912 });
    for (const step of STEPS) {
      await openStep(page, id, step);
      const small = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>(".tkp-post button, .tkp-post a, .tkp-post input:not([type=file]):not([type=checkbox]), .tkp-post select, .tkp-post textarea"))
          .filter((node) => node.getBoundingClientRect().width > 0 && !node.closest("[inert]") && !node.closest(".tkp-consent"))
          .map((node) => ({ name: `${node.tagName.toLowerCase()}.${String(node.className).slice(0, 30)}`, height: Math.round(node.getBoundingClientRect().height) }))
          .filter((item) => item.height < 44),
      );
      expect(small, `step ${step}`).toEqual([]);
      const results = await new AxeBuilder({ page }).include(".tkp-post").analyze();
      expect(results.violations.map((item) => item.id), `step ${step} axe`).toEqual([]);
    }
  });

  test("a laptop screen shows the step card and only the page scrolls", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const id = await draftFor(page, baseURL!, "dating");
    for (const [width, height] of SHORT) {
      await page.setViewportSize({ width, height });
      for (const step of STEPS) {
        await openStep(page, id, step);
        const found = await boxes(page);
        // H21.0 (spec rule 4): only the page scrolls, so the page-height and in-view checks no longer apply.
        expect(found.main!.top, `step ${step} at ${width}x${height}: card starts below the header`).toBeGreaterThan(60);
      }
    }
  });

  test("the phone keeps one column with Exit above the steps and no sideways scroll", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const id = await draftFor(page, baseURL!, "dating");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const step of STEPS) {
      await openStep(page, id, step);
      expect(await hasHorizontalScroll(page), `step ${step}`).toBe(false);
      await expect(page.locator("[data-tk=exit-post]")).toBeVisible();
    }
  });
});

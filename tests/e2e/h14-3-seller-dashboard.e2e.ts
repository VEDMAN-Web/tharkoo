import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, test, uniqueEmail, USER_PASSWORD, withLocalDb } from "./helpers";
import { createLiveAd } from "./flows";

const DAY = 86_400_000;
const SHOTS = process.env.H143_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png`, fullPage: true });
}

let counter = 0;
async function seedEvents(listingId: string, type: "view" | "click", daysAgo: number, count: number) {
  const rows = Array.from({ length: count }, () => ({
    listingId: new ObjectId(listingId),
    type,
    visitorKey: `e2e-dash-${Date.now()}-${(counter += 1)}`,
    createdAt: new Date(Date.now() - daysAgo * DAY - (daysAgo === 0 ? 2 * 60_000 : 0) + counter),
  }));
  if (rows.length) await withLocalDb((db) => db.collection("ad_events").insertMany(rows));
}

async function text(page: Page, selector: string) {
  return ((await page.locator(selector).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
}

async function checkDashboard(page: Page, ids: string[], phone: boolean, goal: number) {
  await page.goto("/u/account/", { waitUntil: "networkidle" });
  const dash = page.locator('[data-tk="seller-dashboard"]');
  await expect(dash).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Your ads at a glance");
  expect(await text(page, '[data-tk="tile-live-value"]')).toBe("3");
  expect(await text(page, '[data-tk="tile-views-value"]')).toBe("28");
  expect(await text(page, '[data-tk="tile-clicks-value"]')).toBe("6");
  expect(await text(page, '[data-tk="tile-views"] .up-dash-pill')).toBe("↑ 460%");
  await expect(page.locator('[data-tk="dash-tiles"] .up-dash-kpi')).toHaveCount(3);
  const tiles = await page.locator('[data-tk="dash-tiles"] .up-dash-kpi').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
  expect(new Set(tiles).size, "the three tiles sit in one row").toBe(1);

  const days = await page.locator('[data-tk="chart-day"]').evaluateAll((nodes) => nodes.map((node) => [Number(node.getAttribute("data-views")), Number(node.getAttribute("data-clicks")), node.getAttribute("data-top")]));
  expect(days).toHaveLength(7);
  expect(days.reduce((sum, day) => sum + Number(day[0]), 0)).toBe(28);
  expect(days.reduce((sum, day) => sum + Number(day[1]), 0)).toBe(6);
  expect(days.every((day) => day[2] === "off")).toBe(true);

  await expect(page.locator('[data-tk="dash-ad"]')).toHaveCount(3);
  const views = await page.locator('[data-tk="ad-views"]').allTextContents();
  expect(views.map((value) => value.trim())).toEqual(["25", "3", "0"]);
  await expect(page.locator('[data-tk="dash-lift"]')).toHaveAttribute("data-state", "empty");
  expect(await text(page, '[data-tk="goal-numbers"]')).toMatch(new RegExp(`^\\d+ / ${goal} views$`));
  await expect(page.locator('[data-tk="milestone"]')).toHaveCount(4);
  expect(await page.locator('[data-tk="milestone"][data-done="yes"]').count()).toBe(1);

  const body = await page.locator("body").innerText();
  expect(body, "the number an admin set for display never shows").not.toContain("55,555");
  expect(body).not.toContain("55555");
  expect(body, "no click rate anywhere").not.toMatch(/click rate|CTR/i);
  await expect(page.locator('[data-tk="availability"]')).toHaveCount(0);
  await expect(page.locator("#support-heading")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Raise a new ticket" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "My account" }).getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "My account" }).getByRole("link", { name: "Help and support" })).toBeVisible();
  expect(await hasHorizontalScroll(page)).toBe(false);

  const small = await page.locator('[data-tk="dash-promote"], .up-dash-btn-alt, .up-dash-link, .up-dash-gold, .up-dash-pink').evaluateAll((nodes) =>
    nodes.filter((node) => node.getClientRects().length > 0).map((node) => [Math.round(node.getBoundingClientRect().height), (node.textContent ?? "").trim().slice(0, 20)]).filter((row) => Number(row[0]) < 44),
  );
  expect(small, `tap targets under 44 px ${phone ? "at 390" : "at 1440"}`).toEqual([]);
  void ids;
}

test.describe("H14.3 seller dashboard", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("D3: a seller with 3 ads sees the real numbers at 1440 and 390, the switches live in Settings, the ticket box is gone", async ({ page, baseURL }) => {
    test.setTimeout(540_000);
    const first = await createLiveAd(page, baseURL!, "dash");
    const mine = await withLocalDb(async (db) => {
      const row = await db.collection("listings").findOne({ _id: new ObjectId(first.listingId) });
      const { _id, ...rest } = row!;
      void _id;
      for (const label of ["two", "three"]) {
        const now = new Date(Date.now() + 1000);
        await db.collection("listings").insertOne({ ...rest, title: `E2E dash ${label} ${Date.now()}`, slug: `e2e-dash-${label}-${Date.now()}`, createdAt: now, updatedAt: now });
      }
      return db.collection("listings").find({ ownerId: row!.ownerId, status: "active" }).sort({ createdAt: 1 }).toArray();
    });
    expect(mine).toHaveLength(3);
    const [a, b, c] = mine!.map((row) => String(row._id));
    await seedEvents(a, "view", 0, 12);
    await seedEvents(a, "view", 1, 8);
    await seedEvents(a, "view", 3, 5);
    await seedEvents(a, "view", 9, 5);
    await seedEvents(a, "click", 0, 4);
    await seedEvents(a, "click", 3, 2);
    await seedEvents(a, "click", 9, 1);
    await seedEvents(b, "view", 0, 3);
    await withLocalDb((db) => db.collection("ad_counters").insertOne({ listingId: new ObjectId(a), realViews: 120, realClicks: 7, viewsSet: 55555, viewsRealAtSet: 0, clicksSet: 44444, clicksRealAtSet: 0, updatedAt: new Date() }));

    await page.setViewportSize({ width: 1440, height: 900 });
    await checkDashboard(page, [a, b, c], false, 100);
    await shot(page, "dashboard");

    const where = page.locator('[data-tk="dash-ad"]').first().locator(".up-dash-ad-where");
    await where.scrollIntoViewIfNeeded();
    const spot = (await where.boundingBox())!;
    await page.mouse.click(spot.x + 6, spot.y + spot.height / 2);
    await expect(page).toHaveURL(/\/ad\//);
    await page.goBack();
    await page.locator('[data-tk="dash-promote"]').first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.locator('[data-tk="goal-change"]').click();
    await page.locator('[data-tk="goal-form"] input').fill("10");
    await page.locator('[data-tk="goal-form"] button[type="submit"]').click();
    await expect(page.locator('[data-tk="goal-error"]')).toBeVisible();
    await page.locator('[data-tk="goal-form"] input').fill("300");
    await page.locator('[data-tk="goal-form"] button[type="submit"]').click();
    await expect.poll(() => text(page, '[data-tk="goal-numbers"]')).toMatch(/\/ 300 views$/);

    await page.setViewportSize({ width: 390, height: 844 });
    await checkDashboard(page, [a, b, c], true, 300);
    await shot(page, "dashboard");

    await page.goto("/u/account/edit-account/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-tk="chat-availability"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /^Available now/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Live chat/ })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.goto("/u/account/analytics/", { waitUntil: "networkidle" });
    expect(await text(page, '[data-tk="total-views"]')).toBe("120");
    expect(await text(page, '[data-tk="week-views"]')).toBe("28");
    expect(await page.locator("body").innerText()).not.toContain("55555");
  });

  test("D4: a buyer with no ads sees today's home, not the dashboard", async ({ page, baseURL }) => {
    const email = uniqueEmail("buyer-dash");
    const signup = await newApi(baseURL!);
    await registerApi(signup, baseURL!, email);
    await signup.dispose();
    await loginUi(page, email, USER_PASSWORD, "/u/account/");
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/u/account/", { waitUntil: "networkidle" });
      await expect(page.locator('[data-tk="seller-dashboard"]')).toHaveCount(0);
      await expect(page.locator("h1")).toHaveText("Find it, save it, chat with the advertiser");
      await expect(page.getByRole("navigation", { name: "My account" }).getByRole("link", { name: "Home" })).toBeVisible();
      await expect(page.locator("#support-heading")).toBeVisible();
      expect(await hasHorizontalScroll(page)).toBe(false);
    }
  });
});

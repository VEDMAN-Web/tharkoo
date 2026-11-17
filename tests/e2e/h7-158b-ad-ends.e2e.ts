import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { createLiveAd } from "./flows";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.158 part 2: end times in All ads and on the ad page. */

const SHOTS = process.env.H7158_SHOTS_DIR ?? "";
const HOUR = 60 * 60 * 1000;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

async function seed(tag: string) {
  return withLocalDb(async (db) => {
    const category = await db.collection("categories").findOne({});
    const owner = new ObjectId();
    await db.collection("users").insertOne({ _id: owner, email: `${tag}@example.test`, displayName: `Ends Seller ${tag}`, status: "active", roles: ["user"], createdAt: new Date() });
    const ids: ObjectId[] = [];
    for (const [index, hours] of [6, 20, 30].entries()) {
      const id = new ObjectId();
      ids.push(id);
      await db.collection("listings").insertOne({
        _id: id,
        ownerId: owner,
        status: "active",
        categoryId: category?._id ?? new ObjectId(),
        title: `Ends ${tag} sofa ${index + 1}`,
        slug: `ends-${tag}-${id.toHexString().slice(-6)}`,
        description: "A well kept thing for sale.",
        feedHidden: true,
        publishedAt: new Date(Date.now() - HOUR),
        expiresAt: new Date(Date.now() + hours * HOUR),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return ids;
  });
}

async function cleanUp(ids: ObjectId[] | null) {
  if (!ids) return;
  await withLocalDb(async (db) => {
    const owners = (await db.collection("listings").find({ _id: { $in: ids } }).project({ ownerId: 1 }).toArray()).map((row) => row.ownerId);
    await db.collection("listings").deleteMany({ _id: { $in: ids } });
    await db.collection("users").deleteMany({ _id: { $in: owners } });
    await db.collection("audit_events").deleteMany({ targetId: { $in: ids.map(String) } });
  });
}

const endOf = async (id: ObjectId) => withLocalDb(async (db) => (await db.collection("listings").findOne({ _id: id }))?.expiresAt as Date | undefined);

test.describe("H7.158 end times", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("All ads: an Ends column in India time, sort, the 24 hour filter, bulk Extend with one Undo", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const tag = `e${Date.now().toString(36)}`;
    const ids = await seed(tag);
    test.skip(!ids, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs.");
    try {
      await signInAdminContext(context, baseURL!);
      for (const [width, height] of [[1440, 900], [390, 844]] as const) {
        await page.setViewportSize({ width, height });
        await page.goto(`/admin/ads/?q=${tag}&sort=ends`);
        await expect(page.locator('[data-tk="ads-screen"]')).toBeVisible();
        if (width > 767) await expect(page.getByRole("columnheader", { name: "Ends" })).toBeVisible();
        const ends = page.locator('[data-tk="ad-ends"]');
        await expect(ends).toHaveCount(3);
        await expect(ends.first()).toContainText(/\d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2} (am|pm)/i);
        await expect(ends.first()).toContainText(/in \d+ h/);
        await expect(page.locator('[data-tk="ads-sort"]')).toHaveValue("ends");
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await serious(page)).toEqual([]);
        await shot(page, "ads-list-ends");
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/admin/ads/?q=${tag}&sort=ends`);
      const titles = async () => (await page.locator("tbody tr").allInnerTexts()).map((text) => /sofa (\d)/.exec(text)?.[1]);
      expect(await titles()).toEqual(["1", "2", "3"]);
      await page.locator('[data-tk="ads-sort"]').selectOption("ends_last");
      await expect(page).toHaveURL(/sort=ends_last/);
      await expect.poll(titles).toEqual(["3", "2", "1"]);
      await page.goto(`/admin/ads/?q=${tag}&ends=24`);
      await expect(page.getByText("Ends within 24 h").first()).toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(2);

      await page.goto(`/admin/ads/?q=${tag}&sort=ends`);
      const before = await Promise.all(ids!.map(endOf));
      await page.getByRole("checkbox", { name: /Select all/i }).check();
      await page.getByRole("button", { name: "Extend..." }).click();
      await page.getByRole("radio", { name: "+24 hours" }).check();
      await page.getByRole("alertdialog").getByRole("button", { name: "Extend", exact: true }).click();
      await expect(page.locator('[data-tk="toast"]')).toContainText("Extended by 24 hours: 3 ads");
      for (const [index, id] of ids!.entries()) expect(Math.abs((await endOf(id))!.getTime() - (before[index]!.getTime() + 24 * HOUR))).toBeLessThan(5000);
      await page.locator('[data-tk="toast-undo"]').click();
      await expect.poll(async () => (await Promise.all(ids!.map(endOf))).map((date) => date!.getTime())).toEqual(before.map((date) => date!.getTime()));
    } finally {
      await cleanUp(ids);
    }
  });

  test("the ad page Status card: change the end time, quick buttons, End now hides it from search at once, Undo", async ({ page, context, baseURL }) => {
    test.setTimeout(420_000);
    const ad = await createLiveAd(page, baseURL!, "endnow");
    await signInAdminContext(context, baseURL!);
    const adminPage = await context.newPage();
    const id = new ObjectId(ad.listingId);
    const read = async () => {
      const row = await withLocalDb((db) => db.collection("listings").findOne({ _id: id }, { projection: { status: 1, expiresAt: 1 } }));
      if (!row) throw new Error("The ad is not in the test database");
      return { status: String(row.status), expiresAt: new Date(row.expiresAt as Date) };
    };
    const search = async () => {
      const res = await adminPage.request.get(`/api/search?q=${encodeURIComponent(ad.title)}`);
      return JSON.stringify(await res.json()).includes(ad.title);
    };
    await expect.poll(search, { timeout: 60_000, intervals: [2_000] }).toBe(true);
    const start = (await read()).expiresAt.getTime();

    for (const [width, height] of [[1440, 900], [390, 844]] as const) {
      await adminPage.setViewportSize({ width, height });
      await adminPage.goto(`/admin/ads/${ad.listingId}/`);
      const card = adminPage.locator('[aria-labelledby="ae-status"]');
      await expect(card.locator('[data-tk="ad-ends"]')).toContainText(/in \d+ h/);
      await expect(card.getByLabel("Ends on (India time)")).toBeVisible();
      for (const name of ["+24 h", "+48 h", "Expire in 24 h", "End now..."]) await expect(card.getByRole("button", { name })).toBeVisible();
      expect(await hasHorizontalScroll(adminPage)).toBe(false);
      expect(await serious(adminPage)).toEqual([]);
      await card.scrollIntoViewIfNeeded();
      await shot(adminPage, "ad-status-card");
    }
    await adminPage.setViewportSize({ width: 1440, height: 900 });
    await adminPage.goto(`/admin/ads/${ad.listingId}/`);
    const card = adminPage.locator('[aria-labelledby="ae-status"]');

    await card.getByRole("button", { name: "+24 h" }).click();
    await expect(adminPage.locator('[data-tk="toast"]')).toContainText("Ends 24 hours later");
    expect(Math.abs((await read()).expiresAt.getTime() - (start + 24 * HOUR))).toBeLessThan(5000);
    await adminPage.locator('[data-tk="toast-undo"]').click();
    await expect.poll(async () => (await read()).expiresAt.getTime()).toBe(start);

    await card.getByLabel("Ends on (India time)").fill("2020-01-01T10:00");
    await card.getByRole("button", { name: "Set end time" }).click();
    await expect(card.locator('[data-tk="ends-on-error"]')).toContainText("future");
    expect((await read()).expiresAt.getTime()).toBe(start);

    await card.getByRole("button", { name: "Expire in 24 h" }).click();
    await expect.poll(async () => Math.abs((await read()).expiresAt.getTime() - (Date.now() + 24 * HOUR)) < 60_000).toBe(true);

    await card.getByRole("button", { name: "End now..." }).click();
    const dialog = adminPage.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "End ad now" }).click();
    await expect(dialog).toContainText(/reason|required|Write/i);
    await dialog.getByRole("textbox").fill("The seller sold it");
    await dialog.getByRole("button", { name: "End ad now" }).click();
    await expect.poll(async () => (await read()).status).toBe("expired");
    await expect.poll(search, { timeout: 30_000, intervals: [1_000] }).toBe(false);
    await expect(adminPage.locator('[data-tk="toast"]')).toContainText("The ad has ended");
    await adminPage.locator('[data-tk="toast-undo"]').click();
    await expect.poll(async () => (await read()).status).toBe("active");
    await expect.poll(search, { timeout: 60_000, intervals: [2_000] }).toBe(true);
  });
});

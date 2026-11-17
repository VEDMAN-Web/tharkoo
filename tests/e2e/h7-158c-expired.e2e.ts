import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { createLiveAd } from "./flows";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.158c: an ad that ran out of time can be brought back from All ads and from the ad page. */

const SHOTS = process.env.H7158C_SHOTS_DIR ?? "";
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

async function row(id: ObjectId) {
  const found = await withLocalDb((db) => db.collection("listings").findOne({ _id: id }, { projection: { status: 1, expiresAt: 1 } }));
  if (!found) throw new Error("The ad is not in the test database");
  return { status: String(found.status), expiresAt: new Date(found.expiresAt as Date) };
}

test.describe("H7.158c bring back an ad that ran out", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("the ad page: an expired ad shows the end buttons (not End now), +24 h brings it back, Undo puts it back", async ({ page, context, baseURL }) => {
    test.setTimeout(420_000);
    const ad = await createLiveAd(page, baseURL!, "backlive");
    const id = new ObjectId(ad.listingId);
    await signInAdminContext(context, baseURL!);
    const admin = await context.newPage();
    const search = async () => JSON.stringify(await (await admin.request.get(`/api/search?q=${encodeURIComponent(ad.title)}`)).json()).includes(ad.title);
    await expect.poll(search, { timeout: 60_000, intervals: [2_000] }).toBe(true);
    const ranOut = new Date(Date.now() - 5 * HOUR);
    await withLocalDb((db) => db.collection("listings").updateOne({ _id: id }, { $set: { status: "expired", expiresAt: ranOut } }));
    await expect.poll(search, { timeout: 30_000, intervals: [1_000] }).toBe(false);

    for (const [width, height] of [[1440, 900], [390, 844]] as const) {
      await admin.setViewportSize({ width, height });
      await admin.goto(`/admin/ads/${ad.listingId}/`);
      const card = admin.locator('[aria-labelledby="ae-status"]');
      await expect(card.getByText("Expired")).toBeVisible();
      await expect(card.locator('[data-tk="ad-ends"]')).toContainText("ended");
      for (const name of ["+24 h", "+48 h", "Expire in 24 h", "Set end time"]) await expect(card.getByRole("button", { name })).toBeVisible();
      await expect(card.getByRole("button", { name: "End now..." })).toHaveCount(0);
      await expect(card.getByRole("button", { name: "Pause" })).toHaveCount(0);
      expect(await hasHorizontalScroll(admin)).toBe(false);
      expect(await serious(admin)).toEqual([]);
      await card.scrollIntoViewIfNeeded();
      await shot(admin, "expired-status-card");
    }
    await admin.setViewportSize({ width: 1440, height: 900 });
    await admin.goto(`/admin/ads/${ad.listingId}/`);
    const card = admin.locator('[aria-labelledby="ae-status"]');
    await card.getByRole("button", { name: "+24 h" }).click();
    await expect(admin.locator('[data-tk="toast"]')).toContainText("The ad is live again");
    await expect.poll(async () => (await row(id)).status).toBe("active");
    expect(Math.abs((await row(id)).expiresAt.getTime() - (Date.now() + 24 * HOUR))).toBeLessThan(60_000);
    await expect.poll(search, { timeout: 60_000, intervals: [2_000] }).toBe(true);
    await shot(admin, "expired-brought-back");
    await admin.locator('[data-tk="toast-undo"]').click();
    await expect.poll(async () => (await row(id)).status).toBe("expired");
    expect((await row(id)).expiresAt.getTime()).toBe(ranOut.getTime());
    await expect.poll(search, { timeout: 30_000, intervals: [1_000] }).toBe(false);
  });

  test("All ads: pick an expired ad, Extend... +48 hours, and it is live again; a removed ad is skipped", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const tag = `x${Date.now().toString(36)}`;
    const ids = await withLocalDb(async (db) => {
      const category = await db.collection("categories").findOne({});
      const owner = new ObjectId();
      await db.collection("users").insertOne({ _id: owner, email: `${tag}@example.test`, displayName: `Back Seller ${tag}`, status: "active", roles: ["user"], createdAt: new Date() });
      const make = async (title: string, status: string) => {
        const id = new ObjectId();
        await db.collection("listings").insertOne({
          _id: id,
          ownerId: owner,
          status,
          categoryId: category?._id ?? new ObjectId(),
          title,
          slug: `back-${tag}-${id.toHexString().slice(-6)}`,
          description: "A well kept thing for sale.",
          feedHidden: true,
          publishedAt: new Date(Date.now() - 80 * HOUR),
          expiresAt: new Date(Date.now() - 8 * HOUR),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return id;
      };
      return { expired: await make(`Back ${tag} ran out`, "expired"), removed: await make(`Back ${tag} removed`, "removed") };
    });
    test.skip(!ids, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs.");
    try {
      await signInAdminContext(context, baseURL!);
      for (const [width, height] of [[1440, 900], [390, 844]] as const) {
        await page.setViewportSize({ width, height });
        await page.goto(`/admin/ads/?q=${tag}`);
        await expect(page.locator('[data-tk="ad-ends"]').first()).toContainText("ended");
        expect(await hasHorizontalScroll(page)).toBe(false);
        await shot(page, "expired-list");
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/admin/ads/?q=${tag}`);
      await page.getByRole("checkbox", { name: /Select all/i }).check();
      await page.getByRole("button", { name: "Extend..." }).click();
      await page.getByRole("radio", { name: "+48 hours" }).check();
      await page.getByRole("alertdialog").getByRole("button", { name: "Extend", exact: true }).click();
      await expect(page.locator('[data-tk="toast"]')).toContainText("1 ad");
      await expect(page.locator('[data-tk="toast"]')).toContainText("skipped");
      expect((await row(ids!.expired)).status).toBe("active");
      expect(Math.abs((await row(ids!.expired)).expiresAt.getTime() - (Date.now() + 48 * HOUR))).toBeLessThan(60_000);
      expect((await row(ids!.removed)).status).toBe("removed");
      await page.locator('[data-tk="toast-undo"]').click();
      await expect.poll(async () => (await row(ids!.expired)).status).toBe("expired");
    } finally {
      await withLocalDb(async (db) => {
        const all = [ids!.expired, ids!.removed];
        const owners = (await db.collection("listings").find({ _id: { $in: all } }).project({ ownerId: 1 }).toArray()).map((item) => item.ownerId);
        await db.collection("listings").deleteMany({ _id: { $in: all } });
        await db.collection("users").deleteMany({ _id: { $in: owners } });
        await db.collection("audit_events").deleteMany({ targetId: { $in: all.map(String) } });
      });
    }
  });
});

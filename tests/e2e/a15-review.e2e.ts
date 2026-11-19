import { mkdirSync } from "node:fs";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, setRoles, test, uniqueEmail, withLocalDb, withoutAddress } from "./helpers";

const SHOTS = process.env.A15_SHOTS_DIR || "";
const DAY_MS = 24 * 60 * 60 * 1000;

async function seedLiveAds(titles: string[]) {
  return withLocalDb(async (db) => {
    const source = await db.collection("listings").findOne({ status: "active" });
    if (!source) throw new Error("no seeded ad");
    await db.collection("sites").updateMany({}, { $set: { postModerationSince: new Date(Date.now() - DAY_MS) } });
    const owner = new ObjectId();
    await db.collection("users").insertOne({ _id: owner, email: `a15-${Date.now()}@example.test`, displayName: "Review Seller", status: "active", roles: ["user"], createdAt: new Date() });
    for (const [index, title] of titles.entries()) {
      const { _id, lastModerationAt, ...rest } = source as Record<string, unknown> & { _id: ObjectId; lastModerationAt?: Date };
      void _id;
      void lastModerationAt;
      const now = new Date(Date.now() - (titles.length - index) * 60_000);
      await db.collection("listings").insertOne({ ...withoutAddress(rest), ownerId: owner, title, slug: `a15-${index}-${Date.now()}`, publishedAt: now, createdAt: now, updatedAt: now });
    }
    return true;
  });
}

test.describe("A15 Ads to review", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("a moderator marks a live ad as checked: the row goes and the tab count drops", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const email = uniqueEmail("a15mod");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    const promoted = await setRoles(email, ["moderator"]);
    test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    const seeded = await seedLiveAds(["Review me one", "Review me two"]);
    test.skip(!seeded, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");

    await loginUi(page, email, undefined, "/admin/moderation/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Ads to review");
    const liveTab = page.getByRole("tab", { name: /Live, not checked/ });
    await expect(liveTab).toBeVisible();
    const countOf = async () => Number(((await liveTab.innerText()).match(/(\d[\d,]*)\s*$/) || [])[1]?.replace(/,/g, "") ?? NaN);
    const before = await countOf();
    expect(before).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole("tab", { name: /Held by rules/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Edited, photos waiting/ })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);

    const row = page.locator("tr, li, [data-tk]").filter({ hasText: "Review me one" }).first();
    await expect(row).toBeVisible();
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: `${SHOTS}/review-list-1440x900.png` });
    }
    await page.getByText("Review me one").first().click();
    await expect(page.locator('[data-tk="review-drawer"]')).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/review-drawer-1440x900.png` });
    await page.getByRole("button", { name: "Approve" }).last().click();
    await expect(page.getByText("Ad approved.")).toBeVisible();
    await page.goto("/admin/moderation/");
    await expect(page.getByText("Review me one")).toHaveCount(0);
    await expect(page.getByText("Review me two").first()).toBeVisible();
    expect(await countOf()).toBe(before - 1);
    if (SHOTS) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await expect(page.getByText("Review me two").first()).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/review-list-390x844.png` });
      expect(await hasHorizontalScroll(page)).toBe(false);
    }
  });
});

import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.171: direct buttons instead of one-item More menus, a grey zero tab, the empty Live queue says when the check is off, one "Quick replies" label. */

const SHOTS = process.env.H7171_SHOTS_DIR ?? "";

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

test.describe("H7.171 Dashboard and queues", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("Dashboard and Ads to review have direct buttons instead of a More menu with one item (1440 and 390)", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/");
    await expect(page.getByRole("button", { name: "More" })).toHaveCount(0);
    await expect(page.locator("#adm-content").getByRole("link", { name: "History & undo" }).first()).toBeVisible();
    await page.goto("/admin/moderation/");
    await expect(page.getByRole("button", { name: "More" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open all ads" })).toBeVisible();
    await shot(page, "review-header");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/moderation/");
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "review-header");
  });

  test("a tab with nothing in it shows a grey number, even when selected", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/media/?tab=trash");
    await page.goto("/admin/moderation/?tab=edited");
    const count = page.locator('[role="tab"][aria-selected="true"] .adm-k-tab-count');
    await expect(count).toBeVisible();
    const text = ((await count.textContent()) ?? "").trim();
    if (text === "0") {
      await expect(count).toHaveAttribute("data-zero", "yes");
      expect(await count.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgb(194, 24, 91)");
    }
    await shot(page, "zero-tab");
  });

  test("when the check after going live is off, the empty Live queue says so and links to Settings; on, it does not", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    const keep = await withLocalDb((db) => db.collection("sites").findOne({}, { projection: { postModerationSince: 1 } }));
    await withLocalDb((db) => db.collection("sites").updateMany({}, { $set: { postModerationSince: null } }));
    try {
      for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(size);
        await page.goto("/admin/moderation/");
        await expect(page.getByRole("heading", { name: "The check after going live is off" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Open Posting rules" })).toHaveAttribute("href", "/admin/settings/#posting");
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await serious(page)).toEqual([]);
        await shot(page, "check-off");
      }
      await withLocalDb((db) => db.collection("sites").updateMany({}, { $set: { postModerationSince: new Date(Date.now() + 86_400_000) } }));
      await page.goto("/admin/moderation/");
      await expect(page.getByRole("heading", { name: "The check after going live is off" })).toHaveCount(0);
    } finally {
      await withLocalDb((db) => db.collection("sites").updateMany({}, { $set: { postModerationSince: keep?.postModerationSince ?? null } }));
    }
  });

  test("the Support desk has ONE Quick replies label and short chip names", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    const subject = `H7171 ticket ${Date.now() % 100000}`;
    const id = await withLocalDb(async (db) => {
      const user = await db.collection("users").findOne({});
      const now = new Date();
      const row = await db.collection("support_tickets").insertOne({ number: 600000 + Math.floor(Math.random() * 90000), ownerId: user?._id, ownerKind: "user", topic: "coins_payments", subject, status: "waiting_for_support", assigneeId: null, lastMessageAt: now, lastCustomerMessageAt: now, unreadForOwner: false, unreadForStaff: true, closedBy: null, closedAt: null, lastStaffViewAt: null, createdAt: now, updatedAt: now });
      await db.collection("ticket_messages").insertOne({ ticketId: row.insertedId, author: user?._id, authorType: "user", body: "Hello", attachments: [], internal: false, opening: true, createdAt: now });
      return String(row.insertedId);
    });
    expect(id).not.toBeNull();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/admin/support/?ticket=${id}`);
    const group = page.getByRole("group", { name: "Quick replies" });
    await expect(group).toBeVisible();
    await expect(page.getByText("Quick replies", { exact: true })).toHaveCount(1);
    await expect(group.getByRole("button", { name: "Payment pending" })).toBeVisible();
    await expect(group.getByRole("button", { name: /^Template:/ })).toHaveCount(0);
    await shot(page, "quick-replies");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/support/?ticket=${id}`);
    await expect(group).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "quick-replies");
  });
});

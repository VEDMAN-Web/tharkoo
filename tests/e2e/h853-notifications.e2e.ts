import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, newUserApi, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.53: the bell is a button that opens a panel of things to act on; clicking one marks it read and opens its page. */

const SHOTS = process.env.H853_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function seedTicket(email: string) {
  const seeded = await withLocalDb(async (db) => {
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (!user) return null;
    const now = Date.now();
    const subject = `Bell ticket ${now % 100000}`;
    const row = await db.collection("support_tickets").insertOne({ number: 700000 + Math.floor(Math.random() * 90000), ownerId: user._id, ownerKind: "user", topic: "coins_payments", subject, status: "waiting_for_support", assigneeId: null, lastMessageAt: new Date(now), lastCustomerMessageAt: new Date(now), unreadForOwner: false, unreadForStaff: true, closedBy: null, closedAt: null, lastStaffViewAt: null, createdAt: new Date(now), updatedAt: new Date(now) });
    await db.collection("ticket_messages").insertOne({ ticketId: row.insertedId, author: user._id, authorType: "user", body: "Hello", attachments: [], internal: false, opening: true, createdAt: new Date(now) });
    return { id: String(row.insertedId), subject };
  });
  expect(seeded).not.toBeNull();
  return seeded!;
}

const countOf = async (page: Page) => {
  const badge = page.locator("[data-tk=bell-count]");
  return (await badge.count()) ? ((await badge.first().textContent()) ?? "").trim() : "";
};

test.describe("H8.53 admin notifications", () => {
  test("the bell opens a panel, Esc and an outside click close it, an item marks itself read and opens its page, Mark all as read clears the number", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "h853cust");
    await api.dispose();
    const { id, subject } = await seedTicket(email);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/");
    await page.waitForLoadState("networkidle");
    const bell = page.locator("[data-tk=bell]");
    await expect(bell).toHaveAttribute("aria-haspopup", "dialog");
    await expect(bell).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("[data-tk=bell-count]")).toBeVisible();

    await bell.click();
    const panel = page.locator("[data-tk=notifications-panel]");
    await expect(panel).toBeVisible();
    await expect(bell).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeFocused();
    const item = panel.locator("[data-tk=notification]", { hasText: subject });
    await expect(item).toHaveAttribute("data-unread", "yes");
    await expect(item).toContainText("New support ticket");
    expect(await hasHorizontalScroll(page)).toBe(false);
    const axe = await new AxeBuilder({ page }).include("[data-tk=notifications-panel]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical").map((entry) => `${entry.id}: ${entry.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "h853-panel");

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(bell).toBeFocused();
    await bell.click();
    await expect(panel).toBeVisible();
    await page.locator("[data-tk=shell-title], h1").first().click({ position: { x: 2, y: 2 } });
    await expect(panel).toHaveCount(0);

    // Clicking an item marks it read and opens its exact page.
    const beforeText = await countOf(page);
    const before = Number(beforeText.replace("+", "")) || 0;
    await bell.click();
    await panel.locator("[data-tk=notification]", { hasText: subject }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/support/\\?ticket=${id}`));
    await expect.poll(async () => await withLocalDb((db) => db.collection("staff_notification_reads").countDocuments({ itemKey: `ticket:${id}` }))).toBe(1);
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.waitForLoadState("networkidle");
    // The number is the unread count for this person: one less now (when it was not capped at "9+").
    if (!beforeText.includes("+")) expect(Number(await countOf(page)) || 0).toBe(before - 1);

    // Mark all as read.
    await bell.click();
    await panel.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.locator("[data-tk=bell-count]")).toHaveCount(0);
    await expect(panel.locator("[data-tk=notification][data-unread=yes]")).toHaveCount(0);

    // See all.
    await panel.getByRole("link", { name: "See all" }).click();
    await expect(page).toHaveURL(/\/admin\/notifications\/$/);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    await page.getByRole("tab", { name: "Unread" }).click();
    await expect(page.getByText("You're all caught up.")).toBeVisible();
    await page.getByRole("tab", { name: "All" }).click();
    await expect(page.locator("[data-tk=notification]").first()).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    const axePage = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axePage.violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical").map((entry) => `${entry.id}: ${entry.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "h853-page");
    await staff.close();
  });

  test("the empty bell says You're all caught up", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.route("**/api/admin/notifications?*", (route) => route.fulfill({ json: { ok: true, data: { items: [], total: 0, unread: 0, page: 1, pageSize: 8, kinds: ["ticket"] } } }));
    await page.goto("/admin/");
    await page.waitForLoadState("networkidle");
    await page.locator("[data-tk=bell]").click();
    await expect(page.locator("[data-tk=notifications-empty]")).toHaveText("You're all caught up.");
    await expect(page.locator("[data-tk=bell-count]")).toHaveCount(0);
    await shot(page, "h853-panel-empty");
    await staff.close();
  });
});

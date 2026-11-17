import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, setRoles, signInAdminContext, test, uniqueEmail, withLocalDb } from "./helpers";

const SHOTS = process.env.A26_SHOTS_DIR || "";
const DAY = 24 * 60 * 60 * 1000;

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

type Seeded = { banned: string; userId: string };

/** Puts a suspended account and a handful of staff changes in the test database: one can be undone for real. */
async function seed(): Promise<Seeded> {
  const email = uniqueEmail("a26banned");
  const userId = new ObjectId();
  const stamp = Date.now();
  const at = (minutes: number) => new Date(stamp - minutes * 60_000);
  const row = (extra: Record<string, unknown>) => ({ actorType: "admin", actorRole: "moderator", targetType: "user", requestId: "e2e", createdAt: at(10), ...extra });
  await withLocalDb(async (db) => {
    await db.collection("users").insertOne({ _id: userId, email, passwordHash: "x", displayName: "Spam Bot", dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), roles: ["user"], status: "suspended", createdAt: new Date(), updatedAt: new Date() });
    await db.collection("audit_events").insertMany([
      row({ action: "user.ban", targetId: String(userId), targetLabel: "spam.bot22", summary: "Banned a user", createdAt: at(5), undo: { kind: "user.ban", until: new Date(stamp + 5 * DAY), data: { pausedListingIds: [] } } }),
      row({ action: "wallet.refund", targetId: "pay1", targetLabel: "TK-P-2281 Sneha R. 500", summary: "Sent a refund", createdAt: at(30), lock: "money_sent" }),
      row({ action: "listing.edit", targetType: "listing", targetId: "ad9", targetLabel: "Honda Activa 2022", summary: "Edited an ad title", createdAt: at(60), undo: { kind: "listing.edit", until: new Date(stamp - DAY), data: {} } }),
      row({ action: "launch.tick", targetType: "site", targetId: "launch-checklist", targetLabel: "Launch checklist", summary: "Ticked the banner row", createdAt: at(90) }),
    ]);
  });
  return { banned: "Banned a user", userId: String(userId) };
}

test.describe("A26 History & undo", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("one H1, the changes with their undo state, locks with the reason, no sideways scroll, axe 0 at laptop and phone size", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await seed();
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/history/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("History & undo");
    await expect(page.getByRole("tab")).toHaveText(["Recent changes", "Full audit log"]);
    const table = page.locator('[data-tk="history-screen"]');
    await expect(table.getByText("Banned a user").first()).toBeVisible();
    await expect(table.getByText("Can undo").first()).toBeVisible();
    await expect(table.getByText("Money sent").first()).toBeVisible();
    await expect(table.getByText("Never").first()).toBeVisible();
    await expect(table.getByText("Time passed").first()).toBeVisible();
    await expect(page.locator('[data-tk="what-can-be-undone"]')).toContainText("30 days");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/history-1440x900.png` });
      await page.screenshot({ path: `${SHOTS}/history-full-1440x900.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/history/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/history-390x844.png` });
      await page.screenshot({ path: `${SHOTS}/history-full-390x844.png`, fullPage: true });
    }
  });

  test("filters narrow the list, the address keeps them, and Export gives the same rows as a CSV", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await seed();
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/history/");
    await page.locator('[data-tk="history-filters"]').getByLabel("Type").selectOption("money");
    await expect(page).toHaveURL(/type=money/);
    await expect(page.getByText("Sent a refund").first()).toBeVisible();
    await expect(page.getByText("Banned a user")).toHaveCount(0);
    await page.locator('[data-tk="history-filters"]').getByLabel("Type").selectOption("");
    await expect(page).not.toHaveURL(/type=money/);
    await page.getByRole("button", { name: "Only what I can undo" }).click();
    await expect(page).toHaveURL(/mine=1/);
    await expect(page.getByText("Sent a refund")).toHaveCount(0);
    await expect(page.getByText("Banned a user").first()).toBeVisible();
    const href = await page.getByRole("link", { name: "Export" }).first().getAttribute("href");
    expect(href).toContain("/admin/history/export/");
    const csv = await context.request.get(`${baseURL}/admin/history/export/`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-disposition"]).toContain("tharkoo-history.csv");
    const body = await csv.text();
    expect(body.split("\r\n")[0]).toBe("When (UTC),Who,Role,What,Record,Type,Reason,Locked");
    expect(body).toContain("Sent a refund");
  });

  test("Undo puts a ban back from its saved data, the row then offers Redo, and Redo bans again", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    const { userId } = await seed();
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/history/");
    const status = async () => withLocalDb((db) => db.collection("users").findOne({ _id: new ObjectId(userId) }, { projection: { status: 1 } }));
    const ban = page.locator('[data-tk="history-screen"] tr, [data-tk="history-screen"] li').filter({ hasText: "Banned a user" }).first();
    await ban.getByRole("button", { name: "Unban" }).click();
    await expect(page.locator('[data-tk="toast"]')).toContainText("User unbanned");
    await expect.poll(async () => (await status())?.status, { timeout: 15_000 }).toBe("active");
    await page.reload();
    const undone = page.locator('[data-tk="history-screen"] tr, [data-tk="history-screen"] li').filter({ hasText: "Banned a user" }).filter({ hasText: "Undone" }).first();
    await expect(undone).toBeVisible();
    await undone.getByRole("button", { name: "Redo" }).click();
    await expect.poll(async () => (await status())?.status, { timeout: 15_000 }).toBe("suspended");
    await page.reload();
    await expect(page.locator('[data-tk="history-screen"]').getByRole("button", { name: "Unban" }).first()).toBeVisible();
  });

  test("a row opens a drawer with what changed, and a moderator has no Full audit log tab", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await seed();
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/history/");
    await page.getByText("Edited an ad title").first().click();
    await expect(page.locator('[data-tk="history-drawer"]')).toBeVisible();
    await expect(page.locator('[data-tk="history-drawer"]')).toContainText("What changed");
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-tk="history-drawer"]')).toHaveCount(0);

    const email = uniqueEmail("a26mod");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    const promoted = await setRoles(email, ["moderator"]);
    test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    const modPage = await context.browser()!.newPage();
    await loginUi(modPage, email, undefined, "/admin/history/");
    await expect(modPage.getByRole("heading", { level: 1 })).toHaveText("History & undo");
    await expect(modPage.getByRole("tab")).toHaveText(["Recent changes"]);
    await modPage.goto("/admin/history/?tab=audit");
    await expect(modPage.getByRole("tab", { selected: true })).toHaveText("Recent changes");
    await modPage.close();
  });
});

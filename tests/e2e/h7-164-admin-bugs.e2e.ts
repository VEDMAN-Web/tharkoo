import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, newUserApi, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.164: small admin bugs found in the full admin audit. One test per bug. */

const SHOTS = process.env.H7164_SHOTS ?? "";
const SEARCH = "Find an ad, user, page";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}

async function staffPage(browser: import("@playwright/test").Browser, baseURL: string) {
  const staff = await browser.newContext({ baseURL });
  const page = await staff.newPage();
  await signInAdminContext(staff, baseURL);
  return page;
}

test.describe("H7.164 small admin bugs", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("a) clicking the search box and typing shows results", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const page = await staffPage(browser, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder(SEARCH).click();
    await page.getByPlaceholder(SEARCH).pressSequentially("tutoring");
    const panel = page.locator('[data-tk="search-panel"]');
    await expect(panel.locator('[data-tk="search-result"]').first()).toBeVisible();
    await shot(page, "a-search-click-type");
  });

  test("a) on a phone the Search button opens the box and typing shows results", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const page = await staffPage(browser, baseURL!);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Search" }).first().click();
    await expect(page.getByPlaceholder(SEARCH)).toBeFocused();
    await page.keyboard.type("tutoring");
    await expect(page.locator('[data-tk="search-panel"] [data-tk="search-result"]').first()).toBeVisible();
    await shot(page, "a-search-phone");
  });

  test("b) after the / key every letter typed at once is kept", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const page = await staffPage(browser, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("/");
    await page.keyboard.type("dating", { delay: 0 });
    await expect(page.getByPlaceholder(SEARCH)).toHaveValue("dating");
  });

  test("c) More is not offered when it has nothing in it: gone on a wide screen, present on a phone where the buttons move into it", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const page = await staffPage(browser, baseURL!);
    for (const path of ["/admin/reports/", "/admin/kyc/"]) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("#adm-content").getByRole("button", { name: "More" })).toBeHidden();
      await shot(page, `c-${path.split("/")[2]}`);
      await page.setViewportSize({ width: 390, height: 844 });
      const more = page.locator("#adm-content").getByRole("button", { name: "More" });
      if ((await more.count()) > 0) {
        await more.click();
        expect(await page.getByRole("menuitem").filter({ visible: true }).count()).toBeGreaterThan(0);
        await page.keyboard.press("Escape");
      }
      await shot(page, `c-${path.split("/")[2]}`);
    }
  });

  test("d) Undo on Settings puts the old value back in the box", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const page = await staffPage(browser, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/settings/");
    const undo = page.locator("[data-tk=undo-windows]");
    const before = await undo.getByLabel("Ad edits").inputValue();
    const changed = before === "45" ? "46" : "45";
    await undo.getByLabel("Ad edits").fill(changed);
    await undo.getByRole("button", { name: "Save undo windows" }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Undo windows saved.");
    await expect(undo.getByLabel("Ad edits")).toHaveValue(changed);
    await page.locator("[data-tk=toast] [data-tk=toast-undo]").click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Change undone.");
    await expect(undo.getByLabel("Ad edits")).toHaveValue(before);
  });

  test("e) the Extend choices are called Extend by", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const page = await staffPage(browser, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/ads/");
    await page.getByRole("checkbox", { name: "Select all rows on this page" }).check();
    await page.getByRole("button", { name: "Extend..." }).click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog.getByRole("group", { name: /^Extend by/ })).toBeVisible();
    await expect(dialog).not.toContainText("Reason");
    await dialog.getByRole("button", { name: "Extend", exact: true }).click();
    await expect(dialog.getByText("Choose how long to extend by.")).toBeVisible();
  });

  test("f) the user drawer tabs all fit: none is cut off at the right", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "h7164tabs");
    await api.dispose();
    const page = await staffPage(browser, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto(`/admin/users/?q=${encodeURIComponent(email)}`);
      await page.locator("[data-tk=server-table] tbody tr .adm-k-rowlink").first().click();
      const drawer = page.locator("[data-tk=drawer]");
      await expect(drawer).toBeVisible();
      const tabs = drawer.getByRole("tab");
      expect(await tabs.count()).toBeGreaterThanOrEqual(5);
      const edge = (await drawer.boundingBox())!;
      const boxes = await tabs.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
      for (const box of boxes) {
        expect(box.right).toBeLessThanOrEqual(edge.x + edge.width + 0.5);
        expect(box.left).toBeGreaterThanOrEqual(edge.x - 0.5);
      }
      await shot(page, "f-user-tabs");
    }
  });

  test("g) an address that does not exist inside /admin/ shows an admin Page not found with a way back", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const page = await staffPage(browser, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      const response = await page.goto("/admin/this-page-does-not-exist/");
      expect(response?.status()).toBe(404);
      await expect(page.locator(".adm .adm-main")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Page not found" }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to Dashboard" })).toHaveAttribute("href", "/admin/");
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "g-not-found");
    }
  });

  test("i) a guest ticket shows the guest's email on the customer card, and the list and the header say the same Over hours", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const stamp = Date.now() % 1_000_000;
    const subject = `Guest question ${stamp}`;
    const email = `guest${stamp}@example.test`;
    const ids = await withLocalDb(async (db) => {
      const hoursAgo = 39 * 3_600_000 + 20 * 60_000;
      const at = new Date(Date.now() - hoursAgo);
      const ticket = await db.collection("support_tickets").insertOne({ number: 800000 + (stamp % 90000), ownerKind: "guest", guestName: "Gita Guest", guestEmail: email, topic: "other", subject, status: "waiting_for_support", assigneeId: null, lastMessageAt: at, lastCustomerMessageAt: at, unreadForOwner: false, unreadForStaff: true, closedBy: null, closedAt: null, createdAt: at, updatedAt: at });
      await db.collection("ticket_messages").insertOne({ ticketId: ticket.insertedId, author: null, authorType: "user", body: "Hello, I have a question.", attachments: [], internal: false, opening: true, createdAt: at });
      return String(ticket.insertedId);
    });
    expect(ids).toBeTruthy();
    const page = await staffPage(browser, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/support/");
    const row = page.locator("[data-tk=desk-row]", { hasText: subject });
    const listAge = (await row.innerText()).match(/Over \d+ h/)?.[0];
    expect(listAge).toBe("Over 39 h");
    await row.click();
    const thread = page.locator("[data-tk=desk-thread]");
    await expect(thread.getByRole("heading", { name: subject })).toBeVisible();
    await expect(thread).toContainText(listAge!);
    await expect(page.locator("[data-tk=desk-user]")).toContainText(email);
  });
});

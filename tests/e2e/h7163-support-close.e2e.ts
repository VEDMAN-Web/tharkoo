import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, newUserApi, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.163: close a ticket with no reply (and undo it), and the red number counts only tickets nobody has opened. */

const SHOTS = process.env.H7163_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function seed(email: string) {
  const seeded = await withLocalDb(async (db) => {
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (!user) return null;
    const now = Date.now();
    const subject = `Close me ${now % 100000}`;
    const ticket = await db.collection("support_tickets").insertOne({ number: 800000 + Math.floor(Math.random() * 90000), ownerId: user._id, ownerKind: "user", topic: "coins_payments", subject, status: "waiting_for_support", assigneeId: null, lastMessageAt: new Date(now - 60_000), lastCustomerMessageAt: new Date(now - 60_000), unreadForOwner: false, unreadForStaff: true, closedBy: null, closedAt: null, lastStaffViewAt: null, createdAt: new Date(now - 60_000), updatedAt: new Date(now - 60_000) });
    await db.collection("ticket_messages").insertOne({ ticketId: ticket.insertedId, author: user._id, authorType: "user", body: "Please close this one.", attachments: [], internal: false, opening: true, createdAt: new Date(now - 60_000) });
    return { id: String(ticket.insertedId), subject };
  });
  expect(seeded).not.toBeNull();
  return seeded!;
}

async function redNumber(page: Page): Promise<number> {
  const pill = page.locator("#desk-open .adm-k-tab-count");
  return (await pill.count()) ? Number((await pill.first().textContent())?.replace(/\D/g, "") || 0) : 0;
}

test.describe("H7.163 support desk", () => {
  test("opening a ticket clears its red number, and Close ticket needs no reply and can be undone", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "h7163cust");
    await api.dispose();
    const { id, subject } = await seed(email);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/support/");
    await page.waitForLoadState("networkidle");
    const before = await redNumber(page);
    expect(before).toBeGreaterThan(0);

    await page.locator("[data-tk=desk-row]", { hasText: subject }).click();
    const thread = page.locator("[data-tk=desk-thread]");
    await expect(thread.getByRole("heading", { name: subject })).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(await redNumber(page)).toBe(before - 1);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "h7163-desk-header");

    // Close with nothing typed.
    await thread.getByRole("button", { name: "Close ticket" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Close without replying?")).toBeVisible();
    await dialog.getByRole("button", { name: "Close ticket" }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("closed. The customer was not emailed.");
    await expect(thread.getByText("This ticket is closed.")).toBeVisible();
    const closed = await withLocalDb(async (db) => ({
      ticket: await db.collection("support_tickets").findOne({ number: { $gt: 0 }, subject }),
      messages: await db.collection("ticket_messages").countDocuments({ ticketId: (await db.collection("support_tickets").findOne({ subject }))?._id }),
    }));
    expect(closed?.ticket?.status).toBe("closed");
    expect(closed?.messages).toBe(1);

    await page.locator("[data-tk=toast]").getByRole("button", { name: "Undo" }).click();
    await expect(thread.getByRole("button", { name: "Close ticket" })).toBeVisible();
    const back = await withLocalDb((db) => db.collection("support_tickets").findOne({ subject }, { projection: { status: 1 } }));
    expect(back?.status).toBe("waiting_for_support");
    expect(id).toBeTruthy();
    await staff.close();
  });
});

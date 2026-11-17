import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, setRoles, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.43 (A43): the support desk in three panes, Add credits inline, templates, Send and close. */

const SHOTS = process.env.A43_SHOTS ?? "";

async function shot(page: Page, name: string, fullPage = true) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage });
}

type Seed = { ticketId: string; subject: string; userId: string; name: string };

/** A payment ticket from a customer, with a waiting crypto payment, in the test database. */
async function seedTicket(email: string, label: string): Promise<Seed> {
  const seeded = await withLocalDb(async (db) => {
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (!user) return null;
    const now = Date.now();
    const subject = `Credits not added ${label} ${now % 100000}`;
    const number = 900000 + Math.floor(Math.random() * 90000);
    const ticket = await db.collection("support_tickets").insertOne({ number, ownerId: user._id, ownerKind: "user", topic: "coins_payments", subject, status: "waiting_for_support", assigneeId: null, lastMessageAt: new Date(now - 5 * 3_600_000), lastCustomerMessageAt: new Date(now - 5 * 3_600_000), unreadForOwner: false, unreadForStaff: true, closedBy: null, closedAt: null, createdAt: new Date(now - 5 * 3_600_000), updatedAt: new Date(now - 5 * 3_600_000) });
    await db.collection("ticket_messages").insertOne({ ticketId: ticket.insertedId, author: user._id, authorType: "user", body: "I paid 1,000 rupees by crypto but my wallet still shows 0 credits.", attachments: [], internal: false, opening: true, createdAt: new Date(now - 5 * 3_600_000) });
    await db.collection("payments").insertOne({ userId: user._id, orderId: user._id, idempotencyKey: `a43-${now}-${Math.random()}`, amount: 1000, currency: "INR", method: "crypto", coin: "USDT", network: "TRC-20", provider: "real", status: "pending", credits: 100, expiresAt: new Date(now + 3_600_000), createdAt: new Date(now - 4 * 3_600_000), updatedAt: new Date(now - 4 * 3_600_000) });
    return { ticketId: String(ticket.insertedId), subject, userId: String(user._id), name: String(user.displayName ?? "") };
  });
  expect(seeded).not.toBeNull();
  return seeded!;
}

test.describe("H8.43 support desk", () => {
  test("three panes: pick a ticket, read it with the order and the customer, use a template, Add credits, send and keep open, send and close", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const { api, email } = await newUserApi(baseURL!, "a43cust");
    await api.dispose();
    const seed = await seedTicket(email, "A");
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/support/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Support desk" })).toBeVisible();
    for (const tab of ["Open", "Waiting on user", "Closed"]) await expect(page.getByRole("tab", { name: new RegExp(`^${tab}`) })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "a43-desk-list");

    const row = page.locator("[data-tk=desk-row]", { hasText: seed.subject });
    await expect(row).toContainText("Over");
    await row.click();
    await expect(page).toHaveURL(/ticket=/);
    const thread = page.locator("[data-tk=desk-thread]");
    await expect(thread.getByRole("heading", { name: seed.subject })).toBeVisible();
    await expect(thread.locator("[data-tk=desk-message]").first()).toContainText("my wallet still shows 0 credits");
    await expect(thread.locator("[data-tk=desk-order]")).toContainText("waiting for the network");
    await expect(thread.locator("[data-tk=desk-order]").getByRole("link", { name: "Open receipt" })).toBeVisible();
    const card = page.locator("[data-tk=desk-user]");
    await expect(card.locator("[data-tk=desk-credits]")).toHaveText("0");
    await expect(card.getByRole("link", { name: "Open user" })).toBeVisible();
    await expect(card.getByRole("link", { name: /^Open order TK-/ })).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "a43-desk-thread");

    await thread.getByRole("button", { name: "Credits added", exact: true }).click();
    await expect(thread.getByLabel("Reply to the customer")).toHaveValue(/^Hi .*, your payment is confirmed now/);

    await card.getByRole("button", { name: "Add credits" }).click();
    const dialog = page.locator("[data-tk=reason-dialog]");
    await dialog.getByLabel("Number of credits").fill("100");
    await dialog.getByLabel("Goodwill").check();
    await dialog.getByRole("button", { name: "Add credits" }).last().click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Added 100 credits to");
    await expect(card.locator("[data-tk=desk-credits]")).toHaveText("100");
    await shot(page, "a43-desk-add-credits", false);

    await thread.getByRole("button", { name: "Send and keep open" }).click();
    await expect(thread.getByText("Reply sent to the customer.")).toBeVisible();
    await expect(thread.locator("[data-tk=desk-message]").last()).toContainText("your payment is confirmed now");

    await thread.getByRole("switch", { name: "Internal note (the user does not see it)" }).click();
    await thread.getByLabel("Internal note (staff only)").fill("Checked the network at 23:58.");
    await thread.getByRole("button", { name: "Save note" }).click();
    await expect(thread.locator("[data-tk=desk-message][data-internal=true]")).toContainText("Checked the network");

    await thread.getByLabel("Reply to the customer").fill("Thanks again for your patience.");
    await thread.getByRole("button", { name: "Send and close" }).click();
    await expect(thread.getByText("Reply sent and ticket closed.")).toBeVisible();
    await expect(thread.getByRole("button", { name: "Reopen ticket" })).toBeVisible();
    await page.goto("/admin/support/?tab=closed");
    await expect(page.locator("[data-tk=desk-row]", { hasText: seed.subject })).toBeVisible();
    await staff.close();
  });

  test("a support agent works the desk and can add credits; a guest-like empty pick shows a prompt; search narrows the list", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const customer = await newUserApi(baseURL!, "a43cust2");
    await customer.api.dispose();
    const seed = await seedTicket(customer.email, "B");
    const agent = await newUserApi(baseURL!, "a43agent");
    await agent.api.dispose();
    expect(await setRoles(agent.email, ["support"])).toBe(true);
    await loginUi(page, agent.email, undefined, "/admin/support/");
    await expect(page.locator("[data-tk=desk-pick]")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search tickets" }).fill("zzzz-no-such");
    await expect(page.getByText("Nothing matches this search.")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search tickets" }).fill(seed.subject.slice(0, 14));
    await expect(page.locator("[data-tk=desk-row]", { hasText: seed.subject })).toBeVisible();
    await page.locator("[data-tk=desk-row]", { hasText: seed.subject }).click();
    await expect(page.locator("[data-tk=desk-user]").getByRole("button", { name: "Add credits" })).toBeVisible();
    await expect(page.locator("[data-tk=desk-order]").getByRole("link", { name: "Open receipt" })).toHaveCount(0);
    await shot(page, "a43-desk-agent");
  });
});

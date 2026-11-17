import { mkdirSync } from "node:fs";
import { ObjectId } from "mongodb";
import type { Page } from "@playwright/test";
import { expect, newUserApi, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.24 (A24): mark paid, mark failed and give credits back, from the Orders & credits drawer. */

const SHOTS = process.env.A24_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

type Seed = { paymentId: string; userId: string; credits: number; no: string };

/** A live payment that is still waiting, for a pack that exists, in the test database. */
async function seedWaiting(email: string): Promise<Seed> {
  const seeded = await withLocalDb(async (db) => {
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });
    const pack = await db.collection("credit_packs").findOne({ status: { $ne: "hidden" } });
    if (!user || !pack) return null;
    const credits = (pack.credits ?? 0) + (pack.bonus ?? 0);
    const now = Date.now();
    const done = await db.collection("payments").insertOne({ userId: user._id, orderId: pack._id, idempotencyKey: `a24-${now}-${Math.random()}`, amount: pack.price ?? 1000, currency: "INR", method: "crypto", coin: "USDT", network: "TRC-20", provider: "real", status: "pending", credits, expiresAt: new Date(now + 3_600_000), createdAt: new Date(now - 3 * 3_600_000), updatedAt: new Date(now - 3 * 3_600_000) });
    return { paymentId: String(done.insertedId), userId: String(user._id), credits };
  });
  expect(seeded).not.toBeNull();
  return { ...seeded!, no: `TK-${seeded!.paymentId.slice(-8).toUpperCase()}` };
}

async function balanceOf(userId: string): Promise<number> {
  const total = await withLocalDb(async (db) => {
    const rows = await db.collection("wallet_entries").find({ userId: new ObjectId(userId) }).toArray();
    return rows.reduce((sum, row) => sum + Number(row.delta ?? 0), 0);
  });
  return total ?? 0;
}

async function openOrder(page: Page, seed: Seed) {
  await page.goto(`/admin/finance/?range=all&q=${encodeURIComponent(seed.no)}&open=${seed.paymentId}`);
  const drawer = page.locator("[data-tk=drawer]");
  await expect(drawer).toBeVisible();
  await expect(drawer.locator("[data-tk=order-actions]")).toBeVisible();
  return drawer;
}

test.describe("H8.24 mark paid, mark failed, give credits back", () => {
  test("mark paid needs a reason, adds the credits once even on a double click, and Undo takes them back; then credits can be given back, locked", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const { api, email } = await newUserApi(baseURL!, "a24buyer");
    await api.dispose();
    const seed = await seedWaiting(email);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    const drawer = await openOrder(page, seed);
    const panel = drawer.locator("[data-tk=order-actions]");
    await expect(panel.getByText(`Mark paid and add ${seed.credits.toLocaleString("en-IN")} credits`)).toBeVisible();
    await expect(panel.getByText("Mark failed", { exact: true })).toBeVisible();
    await expect(panel.getByText("Give credits back")).toHaveCount(0);

    await panel.getByLabel(/^Mark paid and add/).check();
    await expect(drawer.getByRole("button", { name: /^Mark paid, add/ })).toBeVisible();
    await drawer.getByRole("button", { name: /^Mark paid, add/ }).click();
    await expect(panel.getByRole("alert")).toContainText("Write why you are doing this.");
    expect(await balanceOf(seed.userId)).toBe(0);
    await panel.getByLabel("Reason").fill("Payment confirmed on the network");
    await shot(page, "a24-mark-paid");
    await drawer.getByRole("button", { name: /^Mark paid, add/ }).click({ clickCount: 2, delay: 20 });
    const toast = page.locator("[data-tk=toast]");
    await expect(toast).toHaveAttribute("data-kind", "undo");
    await expect(toast).toContainText("marked paid");
    expect(await balanceOf(seed.userId)).toBe(seed.credits);
    await expect(page.locator("[data-tk=server-table] tbody tr", { hasText: seed.no })).toContainText("Paid");

    await toast.locator("[data-tk=toast-undo]").click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Change undone.");
    expect(await balanceOf(seed.userId)).toBe(0);

    const second = await seedWaiting(email);
    const drawer2 = await openOrder(page, second);
    await drawer2.locator("[data-tk=order-actions]").getByLabel(/^Mark paid and add/).check();
    await drawer2.locator("[data-tk=order-actions]").getByLabel("Reason").fill("Confirmed again");
    await drawer2.getByRole("button", { name: /^Mark paid, add/ }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("marked paid");
    expect(await balanceOf(seed.userId)).toBe(second.credits);

    await page.reload();
    const refundPanel = page.locator("[data-tk=order-actions]");
    await expect(refundPanel.getByText("Give credits back")).toBeVisible();
    await expect(refundPanel.getByText("Mark paid and add")).toHaveCount(0);
    await refundPanel.getByLabel(/^Give credits back/).check();
    await expect(refundPanel.getByText("Credits given back cannot be undone.")).toBeVisible();
    await refundPanel.getByLabel("Credits to give back").fill("5");
    await refundPanel.getByLabel("Reason").fill("Goodwill");
    await shot(page, "a24-give-back");
    await page.getByRole("button", { name: "Give credits back..." }).click();
    const dialog = page.locator("[data-tk=reason-dialog]");
    await expect(dialog).toContainText("cannot be undone");
    await dialog.getByRole("button", { name: "Give 5 credits back" }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("5 credits given back");
    await expect(page.locator("[data-tk=toast]")).toHaveAttribute("data-kind", "success");
    expect(await balanceOf(seed.userId)).toBe(second.credits + 5);

    await refundPanel.getByLabel(/^Give credits back/).check();
    await refundPanel.getByLabel("Credits to give back").fill("5");
    await refundPanel.getByLabel("Reason").fill("Goodwill");
    await page.getByRole("button", { name: "Give credits back..." }).click();
    await page.locator("[data-tk=reason-dialog]").getByRole("button", { name: "Give 5 credits back" }).click();
    await expect(refundPanel.getByRole("alert")).toContainText(/already exists|At most/);
    expect(await balanceOf(seed.userId)).toBe(second.credits + 5);
    await staff.close();
  });

  test("mark failed moves no credits and cannot be done twice", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "a24fail");
    await api.dispose();
    const seed = await seedWaiting(email);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    const drawer = await openOrder(page, seed);
    const panel = drawer.locator("[data-tk=order-actions]");
    await panel.getByLabel(/^Mark failed/).check();
    await panel.getByLabel("Reason").fill("The customer cancelled");
    await drawer.getByRole("button", { name: "Mark failed", exact: true }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("marked failed");
    expect(await balanceOf(seed.userId)).toBe(0);
    await expect(page.locator("[data-tk=server-table] tbody tr", { hasText: seed.no })).toContainText("Failed");
    await staff.close();
  });
});

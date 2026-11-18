import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test, withLocalDb } from "./helpers";

const SHOTS = process.env.RECHARGE_SHOTS_DIR || "";
const SIZES = [
  [1536, 674],
  [390, 844],
] as const;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const original = page.viewportSize();
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}x${height}.png` });
  }
  if (original) await page.setViewportSize(original);
}

async function accountId(page: Page): Promise<ObjectId> {
  const me = await page.request.get("/api/auth/me");
  const id = ((await me.json()).data?.user?.id ?? "") as string;
  expect(id, "signed-in account id").toBeTruthy();
  return new ObjectId(id);
}

async function seed(page: Page) {
  const userId = await accountId(page);
  const day = 86_400_000;
  const base = { userId, currency: "INR", provider: "mock" };
  const key = () => `h7112-${new ObjectId()}`;
  const paid = new ObjectId();
  await withLocalDb(async (db) => {
    await db.collection("payments").insertMany([
      { ...base, idempotencyKey: key(), _id: paid, amount: 1000, credits: 100, status: "paid", method: "card", createdAt: new Date(Date.now() - 3 * day) },
      { ...base, idempotencyKey: key(), amount: 500, credits: 50, status: "pending", method: "crypto", coin: "USDT", network: "TRC-20", expiresAt: new Date(Date.now() + day), createdAt: new Date(Date.now() - 2 * day) },
      { ...base, idempotencyKey: key(), amount: 200, credits: 20, status: "failed", outcome: "cancelled", method: "card", createdAt: new Date(Date.now() - day) },
    ]);
    await db.collection("wallet_entries").insertMany([
      { userId, delta: 100, reason: "credit", refType: "payment", refId: String(paid), balanceAfter: 100, idempotencyKey: `h7112-a-${paid}`, createdAt: new Date(Date.now() - 3 * day) },
      { userId, delta: -30, reason: "debit", refType: "listing_fee", refId: "x1", balanceAfter: 70, idempotencyKey: `h7112-b-${paid}`, createdAt: new Date(Date.now() - 2 * day) },
      { userId, delta: -30, reason: "debit", refType: "listing_fee", refId: "x2", balanceAfter: 40, idempotencyKey: `h7112-c-${paid}`, createdAt: new Date(Date.now() - day) },
    ]);
  });
  return String(paid);
}

test.describe("H7.112 credits history in the account panel", () => {
  test("a new account sees the empty state, not the old table or help box", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "histempty");
    await api.dispose();
    await loginUi(page, email, undefined, "/u/account/credits/history/");
    await expect(page.getByRole("heading", { level: 1, name: "Credits history" })).toBeVisible();
    await expect(page.locator("[data-tk=history-empty]")).toContainText("No purchases yet.");
    await page.getByRole("tab", { name: "Credits used" }).click();
    await expect(page.locator("[data-tk=history-empty]")).toContainText("No credits used yet.");
    await expect(page.getByText("Transaction History")).toHaveCount(0);
    await expect(page.getByText(/Do you need help/i)).toHaveCount(0);
    await expect(page.locator("[data-tk=help-card]")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("purchases and credits used show as rows (cards on phones), with a receipt in the same panel", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "histrows");
    await api.dispose();
    await loginUi(page, email, undefined, "/u/account/credits/");
    const paidId = await seed(page);
    await page.goto("/u/account/credits/history/");
    await expect(page.locator(".up-nav")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Credits history");
    await expect(page.getByRole("tab", { name: "Purchases" })).toHaveAttribute("aria-selected", "true");
    const rows = page.locator("[data-tk=purchase-row]");
    await expect(rows).toHaveCount(3);
    const first = page.locator("[data-tk=purchase-row][data-status=cancelled]");
    await expect(first).toContainText("₹200");
    await expect(first).toContainText("Cancelled");
    const card = page.locator("[data-tk=purchase-row][data-status=paid]");
    await expect(card).toContainText("Card");
    await expect(card).toContainText("₹1,000");
    await expect(card).toContainText("100");
    await expect(card).toContainText("Paid");
    await expect(card.locator("svg").first()).toBeVisible();
    await expect(page.locator("[data-tk=purchase-row][data-status=pending]")).toContainText("Crypto USDT TRC-20");
    const phone = (page.viewportSize()?.width ?? 1440) < 641;
    if (phone) expect(await card.evaluate((node) => getComputedStyle(node).display)).toBe("block");
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "h7-112-history");

    await page.getByRole("tab", { name: "Credits used" }).click();
    const used = page.locator("[data-tk=used-row]");
    await expect(used).toHaveCount(2);
    await expect(used.first()).toContainText("Ad posting fee");
    await expect(used.first()).toContainText("−30");
    await expect(page.locator("[data-tk=purchase-row]")).toHaveCount(0);
    await shot(page, "h7-112-used");

    await page.getByRole("tab", { name: "Purchases" }).click();
    await card.getByRole("link", { name: "Receipt" }).click();
    await expect(page).toHaveURL(new RegExp(`/u/account/credits/receipt/${paidId}/$`));
    await expect(page.locator(".up-nav")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Receipt" })).toBeVisible();
    const receipt = page.locator("[data-tk=receipt]");
    await expect(receipt).toContainText("Receipt no.");
    await expect(receipt).toContainText("₹1,000");
    await expect(receipt).toContainText("Paid");
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "h7-112-receipt");
    await receipt.getByRole("link", { name: "Back to history" }).click();
    await expect(page).toHaveURL(/\/u\/account\/credits\/history\/$/);
  });

  test("a signed-out visitor is asked to log in, and another account's receipt is not found", async ({ page, baseURL, browser }) => {
    await page.context().addInitScript(() => {
      localStorage.setItem("nl-age", "ok");
      localStorage.setItem("nl-cookies", "necessary");
    });
    await page.goto("/u/account/credits/history/");
    await expect(page.getByRole("link", { name: /log in/i }).first()).toBeVisible();
    const { api, email } = await newUserApi(baseURL!, "histother");
    await api.dispose();
    await loginUi(page, email, undefined, "/u/account/credits/");
    const missing = await page.goto(`/u/account/credits/receipt/${new ObjectId()}/`);
    expect(missing?.status()).toBe(404);
    void browser;
  });
});

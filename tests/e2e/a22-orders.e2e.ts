import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, setRoles, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.22 (A22): Orders & credits, read only. */

const SHOTS = process.env.A22_SHOTS ?? "";

async function shot(page: Page, name: string, fullPage = true) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage });
}

/** Puts one real payment, one test payment and one that waits too long into the test database for this user. */
async function seedPayments(email: string) {
  const ids: { real: string; test: string; stuck: string } | null = await withLocalDb(async (db) => {
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (!user) return null;
    const now = Date.now();
    const base = { userId: user._id, currency: "INR", method: "card" };
    const rows = [
      { ...base, orderId: user._id, idempotencyKey: `a22-real-${now}`, amount: 4250, credits: 575, status: "paid", provider: "real", createdAt: new Date(now - 60_000), updatedAt: new Date(now - 60_000) },
      { ...base, orderId: user._id, idempotencyKey: `a22-test-${now}`, amount: 1900, credits: 210, status: "paid", provider: "mock", createdAt: new Date(now - 120_000), updatedAt: new Date(now - 120_000) },
      { ...base, orderId: user._id, idempotencyKey: `a22-stuck-${now}`, amount: 2700, credits: 330, status: "pending", provider: "real", method: "crypto", coin: "USDT", network: "TRC-20", expiresAt: new Date(now + 3_600_000), createdAt: new Date(now - 3 * 3_600_000), updatedAt: new Date(now - 3 * 3_600_000) },
    ];
    const done = await db.collection("payments").insertMany(rows);
    return { real: String(done.insertedIds[0]), test: String(done.insertedIds[1]), stuck: String(done.insertedIds[2]) };
  });
  expect(ids).not.toBeNull();
  return ids!;
}

const orderNo = (id: string) => `TK-${id.slice(-8).toUpperCase()}`;

test.describe("H8.22 Orders & credits", () => {
  test("recharges show TEST badges, the four numbers keep test apart, a row opens a drawer with a receipt", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "a22buyer");
    await api.dispose();
    const ids = await seedPayments(email);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/finance/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Orders & credits" })).toBeVisible();
    const kpis = page.locator("[data-tk=orders-kpis]");
    await expect(kpis).toContainText("Real sales today");
    await expect(kpis).toContainText("left out of sales");
    await expect(kpis).toContainText("Recharges to check");
    await expect(kpis).toContainText("Payouts to approve");
    for (const tab of ["Recharges", "Posting fees", "Promotions", "Refunds", "Payouts", "Wallet changes"]) await expect(page.getByRole("tab", { name: new RegExp(`^${tab}`) })).toBeVisible();

    const table = page.locator("[data-tk=server-table]");
    const testRow = table.locator("tbody tr", { hasText: orderNo(ids.test) });
    await expect(testRow).toContainText("TEST");
    await expect(testRow).toContainText("Paid");
    await expect(testRow).toContainText("₹1,900");
    await expect(table.locator("tbody tr", { hasText: orderNo(ids.real) })).not.toContainText("TEST");
    await expect(table.locator("tbody tr", { hasText: orderNo(ids.stuck) })).toContainText("Waiting");
    expect(await hasHorizontalScroll(page)).toBe(false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "a22-orders");

    await testRow.locator(".adm-k-rowlink").click();
    const drawer = page.locator("[data-tk=drawer]");
    await expect(drawer).toBeVisible();
    await expect(page).toHaveURL(/open=/);
    await expect(drawer).toContainText("This was a test payment");
    await expect(drawer).toContainText("Test payment. No money was taken.");
    await shot(page, "a22-order-drawer", false);
    const receipt = drawer.getByRole("link", { name: "Receipt" });
    await expect(receipt).toHaveAttribute("href", `/admin/finance/receipt/${ids.test}/`);
    await page.goto(`/admin/finance/receipt/${ids.test}/`);
    await expect(page.getByRole("heading", { level: 1, name: `Receipt ${orderNo(ids.test)}` })).toBeVisible();
    await expect(page.locator("[data-tk=receipt-test]")).toContainText("TEST");
    await expect(page.locator("[data-tk=receipt-page]")).toContainText("₹1,900");
    await shot(page, "a22-receipt");

    await page.goto("/admin/finance/?range=all&test=hide");
    await expect(page.locator("[data-tk=server-table] tbody tr", { hasText: orderNo(ids.test) })).toHaveCount(0);
    await expect(page.locator("[data-tk=server-table] tbody tr", { hasText: orderNo(ids.real) })).toHaveCount(1);
    await page.goto(`/admin/finance/?q=${encodeURIComponent(orderNo(ids.real))}`);
    await expect(page.locator("[data-tk=server-table] tbody tr")).toHaveCount(1);
    await page.goto("/admin/finance/?q=zzzznobody%40example.com");
    await expect(page.locator("[data-tk=orders-empty]")).toContainText("Nothing matches");
    await staff.close();
  });

  test("the other tabs open, and the payouts tab keeps the payout queue", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    for (const tab of ["fees", "promotions", "refunds", "wallet"]) {
      await page.goto(`/admin/finance/?tab=${tab}&range=all`);
      await expect(page.locator("[data-tk=orders-screen]")).toBeVisible();
      await expect(page.getByRole("tab", { selected: true })).toBeVisible();
    }
    await page.goto("/admin/finance/?tab=refunds");
    await expect(page.locator("[data-tk=blocked-refunds]")).toContainText("Refunds to handle by hand");
    await page.goto("/admin/finance/?tab=payouts");
    await expect(page.locator("[data-tk=payouts-pane]")).toContainText("Withdrawals by advertisers");
    await expect(page.locator("[data-tk=payouts-pane]")).toContainText("TDS, GST and payout rules");
    await staff.close();
  });

  test("finance can open it, support is told they cannot", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const fin = await newUserApi(baseURL!, "a22fin");
    await fin.api.dispose();
    expect(await setRoles(fin.email, ["finance"])).toBe(true);
    await loginUi(page, fin.email, undefined, "/admin/finance/");
    await expect(page.getByRole("heading", { level: 1, name: "Orders & credits" })).toBeVisible();
    const sup = await newUserApi(baseURL!, "a22sup");
    await sup.api.dispose();
    expect(await setRoles(sup.email, ["support"])).toBe(true);
    await page.context().clearCookies();
    await loginUi(page, sup.email, undefined, "/admin/");
    await page.goto("/admin/finance/");
    expect(await page.locator("[data-tk=orders-screen]").count()).toBe(0);
  });
});

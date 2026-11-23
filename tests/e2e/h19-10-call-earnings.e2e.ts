import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, signInAdminContext, test, withLocalDb } from "./helpers";

/**
 * H19.10: the vendor's Earnings screen (Earned from calls, Withdraw and Use for ads side by side, the 1 = 1 line), the admin Money
 * setting "Tharkoo share of video calls (%)" and the finance card "Tharkoo earnings from calls". Set SHOTS_DIR to save screenshots.
 */

const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: `${shotsDir}/${name}-${page.viewportSize()?.width ?? 0}.png`, fullPage: true });
}

test.describe("H19.10 vendor earnings", () => {
  test("Earned from calls, a paid call with price, fee and what the vendor got, two buttons side by side and the 1 = 1 line", async ({ page }, testInfo) => {
    const { email } = await newUserApi(String(testInfo.project.use.baseURL || "http://127.0.0.1:4342"), "h1910v");
    await withLocalDb(async (db) => {
      const user = await db.collection("users").findOne({ email });
      const listing = await db.collection("listings").findOne({});
      // 10 credits earned by this vendor (a ledger transaction that balances), so the Earnings tab shows.
      const owner = String(user!._id);
      await db.collection("ledger_transactions").insertOne({
        idempotencyKey: `e2e-h1910-${owner}`,
        kind: "escrow_release",
        refType: "booking",
        refId: `e2e-${owner}`,
        lines: [
          { account: "external", ownerKey: "system", delta: -15, seq: 1, chainKey: `external:system:e2e-${owner}`, balanceAfter: -15 },
          { account: "vendor_earnings", ownerKey: owner, delta: 10, seq: 1, chainKey: `vendor_earnings:${owner}:1`, balanceAfter: 10 },
          { account: "platform_revenue", ownerKey: "system", delta: 5, seq: 1, chainKey: `platform_revenue:system:e2e-${owner}`, balanceAfter: 5 },
        ],
        createdAt: new Date(),
      });
      await db.collection("video_tours").insertOne({
        listingId: listing!._id,
        ownerId: user!._id,
        userId: new (await import("mongodb")).ObjectId(),
        coins: 15,
        feePercent: 30,
        status: "completed",
        requestedAt: new Date(),
        endedAt: new Date(),
      });
    });
    await loginUi(page, email, undefined, "/u/account/wallet/");
    await page.getByRole("button", { name: "Earnings" }).click();
    const card = page.locator('[data-tk="call-earnings"]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-tk="call-earnings-total"]')).toHaveText("10 credits");
    const call = card.locator('[data-tk="call-earning"]').first();
    await expect(call).toContainText("Price: 15 credits");
    await expect(call).toContainText("Tharkoo fee: 5 credits");
    await expect(call).toContainText("You got: 10 credits");
    const withdraw = page.locator('[data-tk="earn-withdraw"]');
    const ads = page.locator('[data-tk="earn-ads"]');
    await expect(withdraw).toHaveText("Withdraw");
    await expect(ads).toHaveText("Use for ads");
    const a = (await withdraw.boundingBox())!;
    const b = (await ads.boundingBox())!;
    expect(Math.abs(a.y - b.y), "side by side").toBeLessThanOrEqual(2);
    expect(b.x).toBeGreaterThan(a.x + a.width - 1);
    await expect(page.locator('[data-tk="earn-rate"]')).toHaveText("1 earned credit = 1 ad credit. Ad credits pay for posting, TOP and Super Top.");
    await shot(page, "earnings");
    await ads.click();
    await expect(page.getByRole("region", { name: "Move earnings to ad credits" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

test.describe("H19.10 admin", () => {
  test("the Money settings have the Tharkoo share of video calls, and Orders and credits shows Tharkoo earnings from calls", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/prices/");
    const field = page.getByLabel(/Tharkoo share of video calls/);
    await expect(field).toBeVisible();
    await expect(field).toHaveValue("30");
    await shot(page, "admin-money");
    await page.goto("/admin/finance/");
    const revenue = page.locator('[data-tk="call-revenue"]');
    await expect(revenue).toContainText("Tharkoo earnings from calls");
    for (const key of ["today", "week", "month"]) await expect(revenue.locator(`[data-tk="call-revenue-${key}"]`)).toHaveText(/^-?\d+ credits$/);
    await shot(page, "admin-finance");
  });
});

import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, grantCredits, hasHorizontalScroll, originHeaders, test, withLocalDb } from "./helpers";
import { createLiveAd } from "./flows";

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

async function walletBalance(page: Page): Promise<number> {
  return (await (await page.request.get("/api/wallet/")).json()).data.balance as number;
}

test.describe("H7.116 Promote an ad", () => {
  test("the success screen's Get more views opens the Promote sheet with that plan chosen, and paying spends the credits", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "promoup");
    await grantCredits(page, 2000);
    const start = await walletBalance(page);
    const upsell = page.locator("[data-tk=upsell]");
    await expect(upsell).toBeVisible();
    const first = upsell.locator("[data-tk=upsell-plan]").first();
    const planName = ((await first.innerText()).replace(/^Get\s+/, "")).trim();
    await first.click();
    const sheet = page.locator("[data-tk=promote-sheet]");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Promote your ad" })).toBeVisible();
    await expect(sheet.locator("[data-tk=promote-plan][aria-checked=true] .tkpr-plan-name")).toHaveText(planName);
    await expect(sheet.locator("[data-tk=promote-balance]")).toContainText(`${start.toLocaleString("en-IN")} credits`);
    await sheet.locator("[data-tk=promote-pay]").click();
    await expect(sheet.locator("[data-tk=promote-done]")).toContainText(`${planName} is now on your ad.`);
    const price = start - (await walletBalance(page));
    expect(price).toBeGreaterThan(0);
    await expect(sheet.locator("[data-tk=promote-left]")).toContainText(`Credits left: ${(start - price).toLocaleString("en-IN")}`);
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toHaveCount(0);
    expect(ad.listingId).toBeTruthy();
  });

  test("a live ad in My ads has a Promote button: the sheet lists the plans, a short balance leads to Recharge, and paying works", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "promoads");
    await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(ad.listingId) }, { $set: { expiresAt: new Date(Date.now() + 60 * 86_400_000) } }));
    await grantCredits(page, 100);
    const low = await walletBalance(page);
    const missing = 499 - low;
    expect(missing).toBeGreaterThan(0);
    await page.goto("/u/account/ads/");
    const card = page.locator("[data-tk=card]").filter({ hasText: ad.title }).first();
    await expect(card).toBeVisible();
    await card.locator("[data-tk=promote-open]").click();
    const sheet = page.locator("[data-tk=promote-sheet]");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("[data-tk=promote-ad]")).toContainText(ad.title);
    await expect(sheet.locator("[data-tk=promote-balance]")).toContainText(`${low.toLocaleString("en-IN")} credits`);
    const plans = sheet.locator("[data-tk=promote-plan]");
    expect(await plans.count()).toBeGreaterThan(1);
    const top = sheet.locator("[data-tk=promote-plan][data-code=top]");
    await expect(top).toContainText("TOP");
    await expect(top).toContainText("499 credits");
    await expect(top).toContainText("7 days");
    await expect(sheet.locator("[data-tk=promote-plan][data-code=free]")).toHaveCount(0);
    await top.click();
    await expect(sheet.locator("[data-tk=promote-short]")).toHaveText(`You need ${missing} more credits to promote this ad.`);
    await expect(sheet.locator("[data-tk=promote-pay]")).toHaveCount(0);
    await shot(page, "h7-116-sheet-short");

    await sheet.locator("[data-tk=promote-recharge]").click();
    const recharge = page.locator("[data-tk=recharge-sheet]");
    await expect(recharge).toBeVisible();
    await expect(recharge.locator("[data-tk=recharge-short]")).toHaveText(`You need ${missing} more credits to promote your ad.`);
    await page.keyboard.press("Escape");
    await expect(recharge).toHaveCount(0);

    await grantCredits(page, 1900);
    const rich = low + 1900;
    await card.locator("[data-tk=promote-open]").click();
    await expect(sheet.locator("[data-tk=promote-balance]")).toContainText(`${rich.toLocaleString("en-IN")} credits`);
    await sheet.locator("[data-tk=promote-plan][data-code=top]").click();
    await expect(sheet.locator("[data-tk=promote-short]")).toHaveCount(0);
    await expect(sheet.locator("[data-tk=promote-pay]")).toHaveText("Promote for 499 credits");
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "h7-116-sheet-ready");
    await sheet.locator("[data-tk=promote-pay]").click();
    await expect(sheet.locator("[data-tk=promote-done]")).toContainText("TOP is now on your ad.");
    await expect(sheet.locator("[data-tk=promote-left]")).toContainText(`Credits left: ${(rich - 499).toLocaleString("en-IN")}`);
    expect(await walletBalance(page)).toBe(rich - 499);
    await shot(page, "h7-116-sheet-done");
    await sheet.getByRole("link", { name: "See my ads" }).click();
    await expect(page).toHaveURL(/\/u\/account\/ads\/$/);
    await expect(sheet).toHaveCount(0);
  });

  test("two clicks back to back on Promote for N credits charge once and make one promotion", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "promodouble");
    await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(ad.listingId) }, { $set: { expiresAt: new Date(Date.now() + 60 * 86_400_000) } }));
    await grantCredits(page, 2000);
    const before = await walletBalance(page);
    await page.goto("/u/account/ads/");
    const card = page.locator("[data-tk=card]").filter({ hasText: ad.title }).first();
    await card.locator("[data-tk=promote-open]").click();
    const sheet = page.locator("[data-tk=promote-sheet]");
    await sheet.locator("[data-tk=promote-plan][data-code=top]").click();
    const pay = sheet.locator("[data-tk=promote-pay]");
    await expect(pay).toHaveText("Promote for 499 credits");
    await pay.evaluate((node) => {
      (node as HTMLButtonElement).click();
      (node as HTMLButtonElement).click();
    });
    await expect(sheet.locator("[data-tk=promote-done]")).toContainText("TOP is now on your ad.");
    expect(await walletBalance(page)).toBe(before - 499);
    const orders = ((await (await page.request.get("/api/promotions/orders")).json()).data?.items ?? []) as { listingId: string }[];
    expect(orders.filter((order) => order.listingId === ad.listingId)).toHaveLength(1);
    const spent = await withLocalDb((db) => db.collection("wallet_entries").countDocuments({ refType: "promotion", delta: -499 }));
    expect(spent).toBeGreaterThanOrEqual(1);
  });

  test("the server treats the same idempotency key as one purchase", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "promokey");
    await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(ad.listingId) }, { $set: { expiresAt: new Date(Date.now() + 60 * 86_400_000) } }));
    await grantCredits(page, 2000);
    const before = await walletBalance(page);
    const products = ((await (await page.request.get("/api/promotions/products")).json()).data.products ?? []) as { id: string; code: string }[];
    const top = products.find((item) => item.code === "top")!;
    const body = { listingId: ad.listingId, productId: top.id, idempotencyKey: `e2e-same-key-${Date.now()}` };
    const first = await page.request.post("/api/promotions", { headers: originHeaders(baseURL!, "/u/account/ads/"), data: body });
    expect(first.status(), await first.text()).toBe(200);
    const second = await page.request.post("/api/promotions", { headers: originHeaders(baseURL!, "/u/account/ads/"), data: body });
    expect(second.status(), await second.text()).toBe(200);
    expect(await walletBalance(page)).toBe(before - 499);
    const orders = ((await (await page.request.get("/api/promotions/orders")).json()).data?.items ?? []) as { listingId: string }[];
    expect(orders.filter((order) => order.listingId === ad.listingId)).toHaveLength(1);
  });

  test("an ad that is not live has no Promote button", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "promopause");
    const paused = await page.request.post(`/api/listings/${ad.listingId}/pause`, { data: {}, headers: originHeaders(baseURL!, "/u/account/ads/") });
    expect(paused.status(), await paused.text()).toBe(200);
    await page.goto("/u/account/ads/");
    const card = page.locator("[data-tk=card]").filter({ hasText: ad.title }).first();
    await expect(card).toBeVisible();
    await expect(card.locator("[data-tk=promote-open]")).toHaveCount(0);
  });
});

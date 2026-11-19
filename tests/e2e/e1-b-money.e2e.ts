import { adminApi, expect, hasHorizontalScroll, loginUi, newApi, newUserApi, originHeaders, PNG, registerApi, uniqueEmail, USER_PASSWORD, withLocalDb } from "./helpers";
import { finalChecks, test } from "./e1-b-helpers";

/**
 * E1-B: money and identity journeys: buy credits through the test payment page and open the receipt, redeem a coupon,
 * and send an identity check that staff approve or refuse. Test payments only: no card number is asked and no money moves.
 */

async function walletBalance(page: import("@playwright/test").Page) {
  return (await (await page.request.get("/api/wallet/")).json()).data.balance as number;
}

test.describe("E1-B money and identity journeys", () => {
  test.afterEach(async ({ page }, info) => {
    if (info.status === "passed") await finalChecks(page);
  });

  test("credits purchase: Pay opens the test payment page, paying adds the credits, and the receipt is in the history", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { email, api } = await newUserApi(baseURL!, "e1buy");
    await api.dispose();
    await loginUi(page, email, undefined, "/u/account/credits/");
    const start = await walletBalance(page);
    await page.locator("[data-tk=recharge-pay]").click();
    await page.waitForURL(/\/pay\/checkout\//);
    await expect(page.getByText("This is a test payment. No card number is asked and no money moves.")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect.poll(() => walletBalance(page), { timeout: 30_000 }).toBeGreaterThan(start);
    await page.goto("/u/account/credits/history/");
    await expect(page.getByRole("heading", { name: "Credits history" })).toBeVisible();
    const receipt = page.getByRole("link", { name: /receipt/i }).first();
    await expect(receipt).toBeVisible();
    await receipt.click();
    await page.waitForURL(/\/u\/account\/credits\/receipt\//);
    await expect(page.locator("main")).toContainText("₹");
    await expect(page.locator("main")).toContainText(/credits/i);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("coupon: a valid code adds its credits once, and a second try gets a plain sentence", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const code = `E1PROMO${Date.now() % 1000000}`;
    await withLocalDb((db) =>
      db.collection("coupons").insertOne({ code, label: "E1 test credits", value: "50 credits", kind: "credits", credits: 50, status: "active", perUserLimit: 1, maxRedemptions: 100, redeemedCount: 0, createdAt: new Date(), updatedAt: new Date() }),
    );
    const { email, api } = await newUserApi(baseURL!, "e1coupon");
    await api.dispose();
    await loginUi(page, email, undefined, "/u/account/coupons/");
    const start = await walletBalance(page);
    await page.locator("#coupon-code").fill(code);
    await page.locator("[data-tk=apply-coupon]").click();
    await expect.poll(() => walletBalance(page), { timeout: 15_000 }).toBe(start + 50);
    await page.locator("#coupon-code").fill(code);
    await page.locator("[data-tk=apply-coupon]").click();
    await page.waitForTimeout(1500);
    expect(await walletBalance(page), "a second redeem adds nothing").toBe(start + 50);
    await expect(page.locator("main")).not.toContainText(/error|undefined|\[object/i);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("identity check: send the photos, see it is with the team, staff approve it, the page says verified", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { email, api } = await newUserApi(baseURL!, "e1kyc");
    await api.dispose();
    await loginUi(page, email, undefined, "/u/account/kyc/");
    await page.locator("#front-id").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: PNG });
    await page.locator("#selfie-id").setInputFiles({ name: "selfie.png", mimeType: "image/png", buffer: PNG });
    await page.locator("[data-tk=kyc-submit]").click();
    await expect(page.locator("[data-tk=kyc-note]")).toContainText(/review/i);
    // Staff decide in the queue.
    const admin = await adminApi(baseURL!);
    const queue = await admin.get("/api/admin/verifications/?page=1&pageSize=100");
    const items = ((await queue.json()).data?.items ?? []) as { id: string; email?: string; userEmail?: string }[];
    expect(items.length).toBeGreaterThan(0);
    const mine = items.find((item) => JSON.stringify(item).includes(email)) ?? items[items.length - 1];
    const decision = await admin.post(`/api/admin/verifications/${mine.id}/decision/`, { headers: originHeaders(baseURL!, "/admin/"), data: { decision: "approved", reason: "Documents match the account" } });
    expect(decision.status(), await decision.text()).toBe(200);
    await admin.dispose();
    await page.goto("/u/account/kyc/");
    await expect(page.locator("main")).toContainText("ID checked");
    await expect(page.locator("main")).toContainText("Your identity is confirmed");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("identity check: a refused check says to send clear new photos and lets the person send again", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const email = uniqueEmail("e1kycno");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    await loginUi(page, email, USER_PASSWORD, "/u/account/kyc/");
    await page.locator("#front-id").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: PNG });
    await page.locator("#selfie-id").setInputFiles({ name: "selfie.png", mimeType: "image/png", buffer: PNG });
    await page.locator("[data-tk=kyc-submit]").click();
    await expect(page.locator("[data-tk=kyc-note]")).toContainText(/review/i);
    const admin = await adminApi(baseURL!);
    const queue = await admin.get("/api/admin/verifications/?page=1&pageSize=100");
    const items = ((await queue.json()).data?.items ?? []) as { id: string }[];
    const mine = items.find((item) => JSON.stringify(item).includes(email)) ?? items[items.length - 1];
    const decision = await admin.post(`/api/admin/verifications/${mine.id}/decision/`, { headers: originHeaders(baseURL!, "/admin/"), data: { decision: "rejected", reason: "The photo is too dark to read" } });
    expect(decision.status(), await decision.text()).toBe(200);
    await admin.dispose();
    await page.goto("/u/account/kyc/");
    await expect(page.locator("main")).toContainText("Needs another look");
    await expect(page.locator("main")).toContainText("Send clear new ones");
    await expect(page.locator("[data-tk=kyc-submit]")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

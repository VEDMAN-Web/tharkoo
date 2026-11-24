import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, newApi, originHeaders, PNG, registerApi, test, uniqueEmail, USER_PASSWORD, withLocalDb } from "./helpers";

/** H7.112: the whole paid-posting journey with the real money settings: no credits, recharge 100, publish, 70 left, live. */

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

async function setPaidPosting(on: boolean) {
  await withLocalDb((db) =>
    db.collection("sites").updateOne(
      { key: "default" },
      { $set: { paidPostingOn: on, postingFeeCredits: 30, creditPriceInr: 10, mockPaymentsOn: true, freeAdsPerAccount: 0 } },
      { upsert: true },
    ),
  );
}

async function signInNew(page: Page, baseURL: string, prefix: string) {
  const email = uniqueEmail(prefix);
  const signup = await newApi(baseURL);
  await registerApi(signup, baseURL, email);
  await signup.dispose();
  const res = await page.request.post("/api/auth/login", { headers: originHeaders(baseURL, "/u/login/"), data: { email, password: USER_PASSWORD } });
  expect(res.status(), await res.text()).toBe(200);
}

async function stepOf(page: Page, step: number) {
  await expect(page.locator("[data-tk=step-of]")).toContainText(`Step ${step} of 5`);
}

async function reachStepFive(page: Page, title: string) {
  await page.goto("/u/post-insert/");
  await page.locator(".tkp-tile", { hasText: "Dating" }).click();
  await page.locator("[data-tk=go-on]").click();
  await stepOf(page, 2);
  if (await page.locator("#state").count()) await page.locator("#state").selectOption({ label: "Maharashtra" });
  await page.locator("#city").selectOption({ label: "Mumbai" });
  await page.locator("#nickname").fill("Asha");
  await page.locator("#age").fill("28");
  await page.locator("#title").fill(title);
  await page.locator("#text").fill("Looking to meet for coffee and a walk by the sea on weekends.");
  await page.getByRole("button", { name: "Coffee", exact: true }).click();
  await page.locator("[data-tk=go-on]").click();
  await stepOf(page, 3);
  await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
  await page.locator("[data-tk=photo-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("[data-tk=photo-note]")).toContainText(/Photo saved/i);
  await page.locator("[data-tk=go-on]").click();
  await stepOf(page, 4);
  await page.locator("#phone").fill("9876543210");
  await page.locator("[data-tk=go-on]").click();
  await stepOf(page, 5);
}

async function seen(page: Page, path: string, text: string) {
  await expect
    .poll(async () => (await (await page.request.get(path)).text()).includes(text), { timeout: 100_000, intervals: [5_000] })
    .toBe(true);
}

for (const method of ["card", "usdt"] as const) {
  test.describe(`H7.112 paid posting, recharge by ${method === "card" ? "Card (mock)" : "USDT TRC-20 (mock)"}`, () => {
    test.beforeEach(async () => setPaidPosting(true));
    test.afterEach(async () => setPaidPosting(false));

    test("0 credits, Dating ad, amber step 5, recharge 100, publish, 70 left, live on its city page", async ({ page, baseURL }) => {
      test.setTimeout(420_000);
      const title = `Paid ${method} walk ${Date.now()}`;
      await signInNew(page, baseURL!, `flow${method}`);
      await reachStepFive(page, title);

      const card = page.locator("[data-tk=pay-card]");
      await expect(card).toHaveAttribute("data-state", "low");
      await expect(page.locator("[data-tk=pay-fee]")).toHaveText("30 credits");
      await expect(page.locator("[data-tk=pay-balance]")).toHaveText("0 credits");
      await expect(page.locator("[data-tk=publish-blocked]")).toBeDisabled();
      await card.scrollIntoViewIfNeeded();
      await shot(page, `h7-112-${method}-1-amber`);

      await page.locator(".tkp-nav [data-tk=go-on]").click();
      const sheet = page.locator("[data-tk=recharge-sheet]");
      await expect(sheet.locator("[data-tk=recharge-short]")).toContainText("You need 30 more credits");
      await sheet.locator("[data-tk=recharge-pack]").filter({ has: page.locator("strong", { hasText: /^100$/ }) }).click();
      if (method === "usdt") await sheet.locator("[data-tk=recharge-crypto]").click();
      await shot(page, `h7-112-${method}-2-sheet`);
      await sheet.locator("[data-tk=recharge-pay]").click();
      await page.waitForURL(/\/pay\/checkout\//);
      const checkout = page.locator("[data-tk=checkout]");
      await expect(checkout.locator("[data-tk=test-ribbon]")).toBeVisible();
      if (method === "card") {
        await shot(page, `h7-112-${method}-3-checkout`);
        await checkout.getByRole("button", { name: /^Pay ₹/ }).click();
      } else {
        await checkout.locator("[data-tk=coin-USDT]").click();
        await checkout.locator("[data-tk=network-TRC-20]").click();
        await checkout.locator("[data-tk=coin-continue]").click();
        await expect(checkout.locator("[data-tk=deposit-address]")).toHaveText(/^T[A-Za-z0-9]{33}$/);
        await shot(page, `h7-112-${method}-3-checkout`);
        await checkout.locator("[data-tk=crypto-paid]").click();
      }

      await page.waitForURL(/\/u\/post-insert\//, { timeout: 25_000 });
      await stepOf(page, 5);
      await expect(page.locator("[data-tk=recharge-result]")).toHaveAttribute("data-result", "paid");
      await expect(page.locator("[data-tk=pay-card]")).toHaveAttribute("data-state", "ok");
      await expect(page.locator("[data-tk=pay-balance]")).toHaveText("100 credits");
      await expect(page.locator("[data-tk=pay-after]")).toHaveText("70 credits");
      await expect(page.locator(".tkp-nav [data-tk=go-on]")).toHaveText("Publish for 30 credits");
      await page.locator("[data-tk=pay-card]").scrollIntoViewIfNeeded();
      await shot(page, `h7-112-${method}-4-ready`);

      await page.locator("#consent-terms").check();
      await page.locator("#consent-adult").check();
      await page.getByRole("button", { name: "Publish for 30 credits" }).click();
      await expect(page.locator("[data-tk=step-title]")).toHaveText("Your ad is live");
      await expect(page.locator("[data-tk=receipt]")).toHaveText("30 credits paid · Balance 70 credits");
      await shot(page, `h7-112-${method}-5-live`);

      const wallet = await (await page.request.get("/api/wallet/")).json();
      expect(wallet.data.balance).toBe(70);
      await seen(page, "/dating/mumbai/", title);
    });
  });
}

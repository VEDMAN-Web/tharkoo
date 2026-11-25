import type { Page } from "@playwright/test";
import { expect, newApi, originHeaders, PNG, registerApi, test, uniqueEmail, USER_PASSWORD, withLocalDb, pickCity } from "./helpers";

/** H21.5a + H21.6: short on credits at the Review -> Buy-credits dialog -> mock payment -> "Publish with ..." publishes the ad. */

async function setPaidPosting(on: boolean) {
  await withLocalDb((db) =>
    db.collection("sites").updateOne(
      { key: "default" },
      { $set: { paidPostingOn: on, postingFeeCredits: 30, creditPriceInr: 10, mockPaymentsOn: true, freeAdsPerAccount: 0 } },
      { upsert: true },
    ),
  );
}

async function signInNew(page: Page, baseURL: string) {
  const email = uniqueEmail("buyrev");
  const signup = await newApi(baseURL);
  await registerApi(signup, baseURL, email);
  await signup.dispose();
  const res = await page.request.post("/api/auth/login", { headers: originHeaders(baseURL, "/u/login/"), data: { email, password: USER_PASSWORD } });
  expect(res.status(), await res.text()).toBe(200);
}

async function stepOf(page: Page, step: number) {
  await expect(page.locator("[data-tk=step-of]")).toContainText(`Step ${step} of 5`);
}

async function reachReview(page: Page, title: string) {
  await page.goto("/u/post-insert/");
  await page.locator(".tkp-tile", { hasText: "Dating" }).click();
  await page.locator("[data-tk=go-on]").click();
  await stepOf(page, 2);
  await pickCity(page, "Mumbai");
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
  await page.locator("#age").fill("28");
  await page.locator("#nickname").fill("Asha");
  await page.locator("[data-tk=go-on]").click();
  await stepOf(page, 5);
}

test.describe("H21.6 Buy credits from the Review", () => {
  test.beforeEach(async () => setPaidPosting(true));
  test.afterEach(async () => setPaidPosting(false));

  test("short on credits: the dialog opens on the pre-selected pack, a mock payment is made, Publish with ... publishes the ad", async ({ page, baseURL }) => {
    test.setTimeout(420_000);
    await signInNew(page, baseURL!);
    await reachReview(page, `Buy review walk ${Date.now()}`);
    await page.locator("#consent-terms").check();
    const go = page.locator(".tkp-nav [data-tk=go-on]");
    await expect(go).toHaveText("Buy credits to continue");
    await go.click();

    const dialog = page.locator("[data-tk=buy-credits]");
    await expect(dialog).toBeVisible();
    const pack = dialog.locator("[data-tk=buy-pack][aria-checked=true]");
    await expect(pack).toHaveCount(1);
    // First focus is on the pre-selected pack, not on the close button.
    await expect(pack).toBeFocused();

    const popupPromise = page.waitForEvent("popup");
    await dialog.locator("[data-tk=buy-pay]").click();
    const popup = await popupPromise;
    await popup.waitForURL(/\/pay\/checkout\//);
    await popup.locator("[data-tk=checkout]").getByRole("button", { name: /^Pay ₹/ }).click();

    await expect(dialog.locator("[data-tk=buy-paid]")).toBeVisible({ timeout: 60_000 });
    await dialog.locator("[data-tk=buy-publish]").click();
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Your ad is live", { timeout: 60_000 });
  });

  test("Back to review, the X and Esc close the dialog and keep the Review as it was", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    await signInNew(page, baseURL!);
    await reachReview(page, `Buy review close ${Date.now()}`);
    const dialog = page.locator("[data-tk=buy-credits]");
    await page.locator(".tkp-nav [data-tk=go-on]").click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await stepOf(page, 5);
    await page.locator(".tkp-nav [data-tk=go-on]").click();
    await dialog.locator(".tkb-x").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".tkp-nav [data-tk=go-on]")).toHaveText("Buy credits to continue");
  });
});

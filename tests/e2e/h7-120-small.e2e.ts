import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, grantCredits, hasHorizontalScroll, loginUi, newApi, newUserApi, originHeaders, PNG, registerApi, signInAdminContext, test, uniqueEmail, USER_PASSWORD, withLocalDb, pickCity } from "./helpers";
import { createLiveAd } from "./flows";

/** H7.120: money switch labels, the credits pill, India time, one-line labels, contact subtitle, rupee sign. */

const SHOTS = process.env.POST_SHOTS ?? "";
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
    db.collection("sites").updateOne({ key: "default" }, { $set: { paidPostingOn: on, postingFeeCredits: 30, creditPriceInr: 10, mockPaymentsOn: true, freeAdsPerAccount: 0 } }, { upsert: true }),
  );
}

async function accountId(page: Page): Promise<ObjectId> {
  const me = await page.request.get("/api/auth/me");
  return new ObjectId(((await me.json()).data?.user?.id ?? "") as string);
}

test.describe("H7.120 small list", () => {
  test("a: the Paid posting and Test payments switches say On or Off to match their state", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ baseURL });
    await signInAdminContext(context, baseURL!);
    const page = await context.newPage();
    await page.goto("/admin/prices/");
    const section = page.locator('[data-tk="money-settings"]');
    const paid = section.getByRole("switch", { name: /^Paid posting: / });
    await expect(paid).toHaveAttribute("aria-checked", "false");
    await expect(paid).toHaveAccessibleName("Paid posting: Off");
    await paid.click();
    await expect(section.getByRole("switch", { name: "Paid posting: On" })).toHaveAttribute("aria-checked", "true");
    await section.getByRole("switch", { name: "Paid posting: On" }).click();
    await expect(section.getByRole("switch", { name: "Paid posting: Off" })).toHaveAttribute("aria-checked", "false");
    const mock = section.getByRole("switch", { name: /^Test payments: / });
    const state = await mock.getAttribute("aria-checked");
    await expect(mock).toHaveAccessibleName(state === "true" ? "Test payments: On" : "Test payments: Off");
    await setPaidPosting(false);
    await context.close();
  });

  test("b: the header credits pill shows the new balance right after Promote, without a page change", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop-1440", "the pill is a desktop header part");
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "pillpromote");
    await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(ad.listingId) }, { $set: { expiresAt: new Date(Date.now() + 60 * 86_400_000) } }));
    await grantCredits(page, 1000);
    const start = ((await (await page.request.get("/api/wallet/")).json()).data.balance as number);
    await page.goto("/u/account/ads/");
    const pill = page.locator('[data-tk="header-coins"]');
    await expect(pill).toHaveAccessibleName(new RegExp(`^\\d+ call credits and ${start} ad credits\\. Buy credits$`));
    const card = page.locator("[data-tk=card]").filter({ hasText: ad.title }).first();
    await card.locator("[data-tk=promote-open]").click();
    const sheet = page.locator("[data-tk=promote-sheet]");
    await sheet.locator("[data-tk=promote-plan][data-code=bump]").click();
    await sheet.locator("[data-tk=promote-pay]").click();
    await expect(sheet.locator("[data-tk=promote-done]")).toBeVisible();
    await expect(pill).toHaveAccessibleName(new RegExp(`^\\d+ call credits and ${start - 49} ad credits\\. Buy credits$`));
    await shot(page, "h7-120-pill-after-promote");
  });

  test("b: the header pill shows the new balance right after Publish with Paid posting ON", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop-1440", "the pill is a desktop header part");
    test.setTimeout(300_000);
    await setPaidPosting(true);
    try {
      const email = uniqueEmail("pillpublish");
      const signup = await newApi(baseURL!);
      await registerApi(signup, baseURL!, email);
      await signup.dispose();
      const login = await page.request.post("/api/auth/login", { headers: originHeaders(baseURL!, "/u/login/"), data: { email, password: USER_PASSWORD } });
      expect(login.status(), await login.text()).toBe(200);
      await grantCredits(page, 100);
      await page.goto("/u/post-insert/");
      await page.locator(".tkp-tile", { hasText: "Dating" }).click();
      await page.locator("[data-tk=go-on]").click();
      await pickCity(page, "Mumbai");
      await page.locator("#title").fill(`Pill publish ${Date.now()}`);
      await page.locator("#text").fill("Looking to meet for coffee and a walk by the sea on weekends.");
      await page.getByRole("button", { name: "Coffee", exact: true }).click();
      await page.locator("[data-tk=go-on]").click();
      await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
      await page.locator("[data-tk=photo-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
      await expect(page.locator("[data-tk=photo-note]")).toContainText(/Photo saved/i);
      await page.locator("[data-tk=go-on]").click();
      await page.locator("#phone").fill("9876543210");
      await page.locator("#age").fill("28");
      await page.locator("#nickname").fill("Asha");
      await page.locator("[data-tk=go-on]").click();
      await expect(page.locator("[data-tk=step-of]")).toContainText("Step 5 of 5");
      const pill = page.locator('[data-tk="header-coins"]');
      await expect(pill).toContainText(/\d+ call credits and 100 ad credits\. Buy credits/);
      await page.locator("#consent-terms").check();
      if (await page.locator("#consent-adult").count()) await page.locator("#consent-adult").check();
      await page.getByRole("button", { name: /^Publish for 30 credits$/ }).click();
      await expect(page.locator("[data-tk=step-title]")).toHaveText("Your ad is live");
      await expect(pill).toContainText(/\d+ call credits and 70 ad credits\. Buy credits/);
      await shot(page, "h7-120-pill-after-publish");
    } finally {
      await setPaidPosting(false);
    }
  });

  test.describe("c: India time", () => {
    test.use({ timezoneId: "America/New_York" });
    test("the receipt and the history rows show India time, whatever the visitor's clock says", async ({ page, baseURL }) => {
      test.setTimeout(120_000);
      const { api, email } = await newUserApi(baseURL!, "india");
      await api.dispose();
      await loginUi(page, email, undefined, "/u/account/credits/");
      const userId = await accountId(page);
      const paymentId = new ObjectId();
      await withLocalDb((db) =>
        db.collection("payments").insertOne({
          _id: paymentId,
          userId,
          currency: "INR",
          provider: "mock",
          idempotencyKey: `h7120-${paymentId}`,
          amount: 1000,
          credits: 100,
          status: "paid",
          method: "card",
          createdAt: new Date("2026-11-13T19:30:00Z"),
        }),
      );
      await page.goto("/u/account/credits/history/");
      const row = page.locator("[data-tk=purchase-row]").first();
      await expect(row).toContainText("14 Nov 2026");
      await expect(row).toContainText("₹1,000");
      await row.getByRole("link", { name: "Receipt" }).click();
      const receipt = page.locator("[data-tk=receipt]");
      await expect(receipt).toContainText("14 Nov 2026");
      await expect(receipt).toContainText("1:00 am");
      await expect(receipt).toContainText("₹1,000");
      await shot(page, "h7-120-receipt-india-time");
    });
  });

  test("f: the recharge sheet shows the rupee sign, not Rs", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "rupee");
    await api.dispose();
    await loginUi(page, email, undefined, "/u/account/credits/");
    const sheet = page.locator("[data-tk=recharge-sheet]");
    // The sheet listens for this event once the page has loaded; send it until the sheet answers, so a slow load cannot miss it.
    await expect(async () => {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("tk-recharge-open", { detail: {} })));
      await expect(sheet).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    await expect(sheet).toContainText("1 credit = ₹10");
    await expect(sheet.locator("[data-tk=recharge-pack]").first()).toContainText("₹");
    await expect(sheet.locator("[data-tk=recharge-pay]")).toHaveText(/^Pay ₹[0-9,]+$/);
    expect(await sheet.innerText()).not.toMatch(/\bRs\b/);
    await shot(page, "h7-120-recharge-rupee");
    await sheet.locator("[data-tk=recharge-pay]").click();
    await page.waitForURL(/\/pay\/checkout\//);
    const checkout = page.locator("[data-tk=checkout]");
    await expect(checkout.locator("[data-tk=checkout-amount]")).toContainText("₹");
    await expect(checkout.getByRole("button", { name: /^Pay ₹/ })).toBeVisible();
    expect(await checkout.innerText()).not.toMatch(/\bRs\b/);
    await shot(page, "h7-120-checkout-rupee");
  });

  test("g: in edit mode the review note talks about saving, and a paused ad says it stays paused", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const ad = await createLiveAd(page, baseURL!, "editnote");
    await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=5`);
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Review your changes");
    const note = page.locator("[data-tk=review-step]");
    await expect(note).toContainText("Your changes show on your ad as soon as you save.");
    await expect(note).not.toContainText("goes live as soon as you publish");
    const paused = await page.request.post(`/api/listings/${ad.listingId}/pause`, { data: {}, headers: originHeaders(baseURL!, "/u/account/ads/") });
    expect(paused.status(), await paused.text()).toBe(200);
    await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=5`);
    await expect(note).toContainText("Your ad stays paused until you resume it.");
    await shot(page, "h7-120-edit-note-paused");
  });

  test("d and e: a long title keeps the Title label on one line, and the contact step has no email buttons", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const ad = await createLiveAd(page, baseURL!, "labels");
    const long = `${ad.title} with a very long title that keeps going and going so that it needs more than one line to show`;
    const patched = await page.request.patch(`/api/listings/${ad.listingId}`, {
      headers: { origin: baseURL!, referer: `${baseURL}/u/post-insert/` },
      data: { stage: "basics", title: long.slice(0, 120) },
    });
    expect(patched.status(), await patched.text()).toBe(200);
    await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=5`);
    await expect(page.locator("[data-tk=review-step]")).toBeVisible();
    const label = page.locator(".tkp-summary dt", { hasText: /^Title$/ });
    await expect(label).toBeVisible();
    const box = (await label.boundingBox())!;
    expect(box.height).toBeLessThan(24);
    expect(await label.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "h7-120-summary-long-title");

    await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=2`);
    for (let turn = 0; turn < 6; turn += 1) {
      if (/^(Contact|About you)$/.test(await page.locator("[data-tk=step-title]").innerText())) break;
      await page.locator("[data-tk=go-on]").click();
      await page.waitForTimeout(400);
    }
    await expect(page.locator("[data-tk=step-title]")).toHaveText("About you"); // H21.4
    await expect(page.locator("[data-tk=step-help]")).toContainText("How people will see you and reach you."); // H21.4: one lead line for step 4
    await expect(page.getByRole("button", { name: "Email only", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Phone only", exact: true })).toHaveCount(0);
    await shot(page, "h7-120-contact-no-email-buttons");
  });
});

import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { becomeSeller, expect, hasHorizontalScroll, loginUi, newApi, newUserApi, originHeaders, PNG, registerApi, signInAdminContext, test, uniqueEmail, USER_PASSWORD, withLocalDb } from "./helpers";

/** H11.1b: clear prices. The "What things cost" card, the pack lines, the one-line versions and the step 5 cost box, all from live settings. */

const SHOTS = process.env.H111_SHOTS_DIR ?? "";
const MONEY_KEYS = ["paidPostingOn", "postingFeeCredits", "creditPriceInr", "mockPaymentsOn", "freeAdsPerAccount"] as const;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

/** Sets the money settings and the TOP and Super Top plans of the local test database, and returns a function that puts everything back. */
async function setPrices(values: { free: number; paid?: boolean }) {
  const saved = await withLocalDb(async (db) => {
    const site = (await db.collection("sites").findOne({ key: "default" })) ?? {};
    const plans = await db.collection("promotion_products").find({ code: { $in: ["top", "super-top"] } }).toArray();
    await db.collection("sites").updateOne(
      { key: "default" },
      { $set: { paidPostingOn: values.paid ?? true, postingFeeCredits: 20, creditPriceInr: 10, mockPaymentsOn: true, freeAdsPerAccount: values.free } },
      { upsert: true },
    );
    for (const [code, amount] of [["top", 45], ["super-top", 75]] as const) {
      await db.collection("promotion_products").updateOne({ code }, { $set: { amount, durationHours: 72, durationDays: 3, enabled: true } });
    }
    return { site, plans };
  });
  return async () => {
    await withLocalDb(async (db) => {
      for (const key of MONEY_KEYS) {
        if (saved?.site && key in saved.site) await db.collection("sites").updateOne({ key: "default" }, { $set: { [key]: (saved.site as Record<string, unknown>)[key] } });
        else await db.collection("sites").updateOne({ key: "default" }, { $unset: { [key]: "" } });
      }
      for (const plan of saved?.plans ?? []) await db.collection("promotion_products").replaceOne({ _id: plan._id }, plan);
    });
  };
}

const rupeeNumber = (text: string) => Number(text.replace(/[^\d]/g, ""));

async function checkCard(page: Page) {
  const card = page.locator('[data-tk="price-card"]');
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "What things cost" })).toBeVisible();
  await expect(card.locator('[data-tk="price-row-free"] .tkc-name')).toHaveText("Ads 1, 2 and 3");
  await expect(card.locator('[data-tk="price-row-free"]')).toContainText("Your first 3 ads cost nothing.");
  await expect(card.locator('[data-tk="price-free"]')).toHaveText("FREE");
  await expect(card.locator('[data-tk="free-left"]')).toContainText("3 free ads left");
  const adRow = card.locator('[data-tk="price-row-ad"]');
  await expect(adRow.locator(".tkc-name")).toHaveText("Ad 4 and every ad after");
  await expect(adRow.locator('[data-tk="price-rupees"]')).toHaveText("₹200");
  await expect(adRow.locator('[data-tk="price-credits"]')).toHaveText("20 credits");
  await expect(card.locator('[data-tk="price-row-top"] [data-tk="price-rupees"]')).toHaveText("₹450");
  await expect(card.locator('[data-tk="price-row-top"] [data-tk="price-credits"]')).toHaveText("45 credits");
  await expect(card.locator('[data-tk="price-row-top"]')).toContainText("72 hours");
  await expect(card.locator('[data-tk="price-row-super-top"] [data-tk="price-rupees"]')).toHaveText("₹750");
  await expect(card.locator('[data-tk="price-row-super-top"] [data-tk="price-credits"]')).toHaveText("75 credits");
  await expect(card.locator('[data-tk="price-rate"]')).toHaveText("1 credit = ₹10");
  // Big readable prices.
  const size = await adRow.locator('[data-tk="price-rupees"]').evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  expect(size).toBeGreaterThanOrEqual(22);
  expect(await card.innerText()).not.toMatch(/—|–|\bseller\b|\bvendor\b|\bbuyer\b/i);
  return card;
}

async function checkPacks(page: Page) {
  const packs = page.locator('[data-tk="credit-packs"] [data-tk="recharge-pack"]');
  const count = await packs.count();
  expect(count).toBeGreaterThanOrEqual(1);
  for (let index = 0; index < count; index += 1) {
    const pack = packs.nth(index);
    const get = await pack.locator('[data-tk="pack-get"]').innerText();
    const total = rupeeNumber(get.match(/You get ([\d,]+) credits/)?.[1] ?? "0");
    const line = await pack.locator('[data-tk="pack-ads"]').innerText();
    const ads = Math.floor(total / 20);
    const top = Math.floor(total / 45);
    const superTop = Math.floor(total / 75);
    const parts = [`${ads} ${ads === 1 ? "ad" : "ads"}`];
    if (top >= 1) parts.push(`${top} TOP`);
    if (superTop >= 1) parts.push(`${superTop} Super Top`);
    expect(line.replace(/\s+/g, " ").trim()).toBe(`Enough for ${parts.join(", or ")}`);
    expect(await pack.locator('[data-tk="pack-rupees"]').evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(22);
    expect((await pack.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
}

async function signIn(page: Page, baseURL: string, prefix: string) {
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

test.describe("H11.1b clear prices", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("the price card and the pack lines show on the credits page and the Wallet at 1440 and 390, from live settings; the help page and the sheet carry them too", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const restore = await setPrices({ free: 3 });
    try {
      const { api, email } = await newUserApi(baseURL!, "h111card");
      await api.dispose();
      await loginUi(page, email, undefined, "/u/account/credits/");
      for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(size);
        await page.goto("/u/account/credits/");
        const card = await checkCard(page);
        await expect(page.locator('[data-tk="credit-packs"]')).toBeVisible();
        await checkPacks(page);
        const [cardBox, packsBox] = [await card.boundingBox(), await page.locator('[data-tk="credit-packs"]').boundingBox()];
        if (size.width >= 900) expect(cardBox!.x).toBeLessThan(packsBox!.x);
        else expect(cardBox!.y).toBeLessThan(packsBox!.y);
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await serious(page)).toEqual([]);
        if (size.width < 768) {
          for (const button of await page.locator('[data-tk="credit-packs"] button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        await shot(page, "credits-page");
      }
      // The Wallet: the Buy credits tab.
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/u/account/wallet/");
      await page.getByRole("button", { name: "Buy credits" }).click();
      await checkCard(page);
      await checkPacks(page);
      await shot(page, "wallet-buy");
      // The help page for a visitor: the card with the first free ads, no personal counts.
      await page.context().clearCookies();
      for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(size);
        await page.goto("/help/credits/");
        const help = page.locator('[data-tk="price-card"]');
        await expect(help).toBeVisible();
        await expect(help.locator('[data-tk="price-row-free"]')).toContainText("Your first 3 ads cost nothing.");
        await expect(help.locator('[data-tk="free-left"]')).toHaveCount(0);
        await expect(help.locator('[data-tk="price-row-ad"] [data-tk="price-rupees"]')).toHaveText("₹200");
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await serious(page)).toEqual([]);
        await shot(page, "help-credits");
      }
    } finally {
      await restore();
    }
  });

  test("a row is left out when its plan is hidden, and posting that is free everywhere says so", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const restore = await setPrices({ free: 3 });
    try {
      await withLocalDb((db) => db.collection("promotion_products").updateOne({ code: "super-top" }, { $set: { enabled: false } }));
      const { api, email } = await newUserApi(baseURL!, "h111hide");
      await api.dispose();
      await loginUi(page, email, undefined, "/u/account/credits/");
      await expect(page.locator('[data-tk="price-row-top"]')).toBeVisible();
      await expect(page.locator('[data-tk="price-row-super-top"]')).toHaveCount(0);
      await expect(page.locator('[data-tk="pack-ads"]').first()).not.toContainText("Super Top");
      await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { paidPostingOn: false } }));
      await page.goto("/u/account/credits/");
      await expect(page.locator('[data-tk="price-row-all"]')).toContainText("Your first 3 ads are free.");
      await expect(page.locator('[data-tk="price-row-ad"]')).toHaveCount(0);
    } finally {
      await restore();
    }
  });

  test("the one-line versions: the Account home card and the recharge sheet say '3 free ads left, then ₹200 per ad'", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const restore = await setPrices({ free: 3 });
    try {
      const { api, email } = await newUserApi(baseURL!, "h111line");
      await api.dispose();
      await loginUi(page, email, undefined, "/u/account/credits/");
      await becomeSeller(page, baseURL!);
      for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(size);
        await page.goto("/u/account/");
        await expect(page.locator('[data-tk="coin-price-line"]')).toHaveText("3 free ads left, then ₹200 per ad");
        await shot(page, "account-home");
        const sheet = page.locator("[data-tk=recharge-sheet]");
        // The opener listens once the page has hydrated; a single early event is lost, so send it again until the sheet shows.
        await expect(async () => {
          await page.evaluate(() => window.dispatchEvent(new CustomEvent("tk-recharge-open", { detail: {} })));
          await expect(sheet).toBeVisible({ timeout: 1500 });
        }).toPass({ timeout: 20_000 });
        await expect(sheet.locator('[data-tk="recharge-price-line"]')).toHaveText("3 free ads left, then ₹200 per ad");
        await expect(sheet.locator('[data-tk="pack-ads"]').first()).toContainText("Enough for");
        expect(await hasHorizontalScroll(page)).toBe(false);
        await shot(page, "recharge-sheet");
        await page.keyboard.press("Escape");
      }
    } finally {
      await restore();
    }
  });

  test("step 5 of posting: a free ad says 'This ad is FREE (free ad 1 of 3)', a paid ad says 'This ad costs ₹200 (20 credits)' and then the balance lines", async ({ page, baseURL }) => {
    test.setTimeout(420_000);
    const restore = await setPrices({ free: 3 });
    try {
      await signIn(page, baseURL!, "h111free");
      await page.setViewportSize({ width: 1440, height: 900 });
      await reachStepFive(page, `Free ad ${Date.now()}`);
      // H19.6b: the "This ad is FREE" box is now a Free / TOP / Super Top choice, with Free chosen.
      await expect(page.locator("[data-tk=pay-card]")).toHaveCount(0);
      await expect(page.locator("[data-tk=boost-choice]")).toBeVisible();
      await expect(page.locator("[data-tk=boost-choice] [role=radio][data-code=free]")).toHaveAttribute("aria-checked", "true");
      await expect(page.locator(".tkp-nav [data-tk=go-on]")).toHaveText("Publish ad");
      await page.locator("[data-tk=boost-choice]").scrollIntoViewIfNeeded();
      await shot(page, "step5-free");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("[data-tk=boost-choice]").scrollIntoViewIfNeeded();
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "step5-free");
      await restore();

      // Nothing is free now: the same step shows the price.
      const restoreAgain = await setPrices({ free: 0 });
      try {
        await signIn(page, baseURL!, "h111paid");
        await page.setViewportSize({ width: 1440, height: 900 });
        await reachStepFive(page, `Paid ad ${Date.now()}`);
        await expect(page.locator("[data-tk=pay-headline]")).toHaveText("This ad costs ₹200 (20 credits)");
        await expect(page.locator("[data-tk=pay-fee]")).toHaveText("20 credits");
        await expect(page.locator("[data-tk=pay-balance]")).toHaveText("0 credits");
        await expect(page.locator("[data-tk=pay-card]")).toHaveAttribute("data-state", "low");
        await page.locator("[data-tk=pay-card]").scrollIntoViewIfNeeded();
        await shot(page, "step5-paid");
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("[data-tk=pay-card]").scrollIntoViewIfNeeded();
        expect(await hasHorizontalScroll(page)).toBe(false);
        await shot(page, "step5-paid");
      } finally {
        await restoreAgain();
      }
    } finally {
      await restore();
    }
  });

  test("admin: Free ads for each account in Prices & plans, and Extra free ads in the Users drawer, save, show in the data and can be undone", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const restore = await setPrices({ free: 3 });
    try {
      const { api, email } = await newUserApi(baseURL!, "h111admin");
      await api.dispose();
      await signInAdminContext(context, baseURL!);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/admin/prices/");
      const field = page.getByLabel("Free ads for each account");
      await expect(field).toHaveValue("3");
      await field.fill("5");
      await page.getByRole("button", { name: "Save changes" }).first().click();
      await expect.poll(async () => (await withLocalDb((db) => db.collection("sites").findOne({ key: "default" }, { projection: { freeAdsPerAccount: 1 } })))?.freeAdsPerAccount).toBe(5);
      await field.fill("-1");
      await page.getByRole("button", { name: "Save changes" }).first().click();
      await expect(page.getByText("Enter a whole number from 0 to 1000.")).toBeVisible();
      await shot(page, "admin-prices");
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "admin-prices");

      const user = await withLocalDb((db) => db.collection("users").findOne({ email }, { projection: { _id: 1 } }));
      for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(size);
        await page.goto(`/admin/users/?open=${user!._id}`);
        const card = page.locator('[data-tk="free-ads-card"]');
        await expect(card).toBeVisible();
        await card.getByLabel("Extra free ads").fill(size.width > 800 ? "2" : "4");
        await card.getByRole("button", { name: "Save extra free ads" }).click();
        await expect.poll(async () => (await withLocalDb((db) => db.collection("users").findOne({ email }, { projection: { extraFreeAds: 1 } })))?.extraFreeAds).toBe(size.width > 800 ? 2 : 4);
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await serious(page)).toEqual([]);
        await shot(page, "admin-users-extra-free");
      }
      await page.getByRole("button", { name: "Undo" }).first().click();
      await expect.poll(async () => (await withLocalDb((db) => db.collection("users").findOne({ email }, { projection: { extraFreeAds: 1 } })))?.extraFreeAds ?? 0).toBe(2);
    } finally {
      await restore();
    }
  });
});

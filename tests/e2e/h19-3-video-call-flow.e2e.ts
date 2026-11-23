import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, isPhone, loginUi, newUserApi, realAdPath, setSellerAvailable, slugFromAdPath, test, withLocalDb } from "./helpers";

const FEED = "/property/bengaluru/";
const COINS = 10;
const BANNED = /free ads?|per ad|publish|ad credits?/i;
const SHOTS = ".shots/H19.3";

type TourSwitch = { enabled: boolean; coins: number };

async function readSwitch(): Promise<TourSwitch> {
  const row = await withLocalDb((db) => db.collection("categories").findOne({ slug: "property" }, { projection: { videoTourEnabled: 1, videoTourCoins: 1 } }));
  return { enabled: row?.videoTourEnabled === true, coins: row?.videoTourCoins ?? 1 };
}

async function writeSwitch(value: TourSwitch) {
  const res = await withLocalDb((db) => db.collection("categories").updateOne({ slug: "property" }, { $set: { videoTourEnabled: value.enabled, videoTourCoins: value.coins } }));
  expect(res?.matchedCount).toBe(1);
}

/** H18.8: a video call is offered only on an ad with TOP or Super Top running now. */
async function promote(slug: string) {
  const done = await withLocalDb(async (db) => {
    const listing = await db.collection("listings").findOne({ slug }, { projection: { _id: 1 } });
    if (!listing) return false;
    const now = Date.now();
    const product = await db.collection("promotion_products").findOne({ code: "top" }, { projection: { _id: 1 } });
    await db.collection("promotion_orders").insertOne({ productId: product?._id, listingId: listing._id, status: "active", startsAt: new Date(now - 3_600_000), endsAt: new Date(now + 86_400_000), createdAt: new Date(), updatedAt: new Date() });
    return true;
  });
  expect(done, "the ad and the test database are there").toBe(true);
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}

/** The video call button: in the sticky bar on a phone, in the contact card on a wider screen. */
function tourButton(page: Page) {
  return page.locator(isPhone(page) ? "[data-tk=bottom-bar]" : "[data-tk=contact-card]").locator("[data-tk=tour]");
}

test.describe("H19.3 the video call flow for users", () => {
  let original: TourSwitch | null = null;
  const packIds: unknown[] = [];

  test.beforeAll(async () => {
    original = await readSwitch();
    await writeSwitch({ enabled: true, coins: COINS });
    // The test database has no call packs: four are added for this file and removed afterwards.
    await withLocalDb(async (db) => {
      const made = await db.collection("credit_packs").insertMany(
        [100, 250, 500, 1000].map((price, order) => ({ credits: price / 10, price, bonus: 0, status: "active", order: 90 + order, wallet: "call", createdAt: new Date(), updatedAt: new Date() })),
      );
      packIds.push(...Object.values(made.insertedIds));
    });
  });

  test.afterAll(async () => {
    if (original) await writeSwitch(original);
    await withLocalDb((db) => db.collection("credit_packs").deleteMany({ _id: { $in: packIds as never[] } }));
  });

  test("buy call credits inside the pop-up, pay, and come back to the same ad with the call ready", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "callflow");
    await api.dispose();
    await loginUi(page, email);
    const path = await realAdPath(page, FEED);
    await setSellerAvailable(slugFromAdPath(path), true);
    await promote(slugFromAdPath(path));
    await page.goto(path);
    const adUrl = page.url();

    await tourButton(page).click();
    const popup = page.locator("[data-tk=ad-popup]");
    await expect(popup).toHaveAttribute("data-step", "call");
    await expect(popup.locator("h2")).toHaveText("Video call and verify");
    await expect(popup).toContainText("See the person live before you meet");
    await expect(popup).toContainText("Verify before you spend thousands");
    await expect(popup).toContainText("You pay only if the call connects");
    await expect(popup.locator("[data-tk=call-price]")).toHaveText(`1 call = ${COINS} credits`);
    await expect(popup.locator("[data-tk=call-balance]")).toHaveText("0");
    await expect(popup.locator(".tkn-pop-btn")).toHaveCount(1);
    await expect(popup.locator("[data-tk=call-main]")).toHaveText("Buy call credits");
    expect(await popup.innerText()).not.toMatch(BANNED);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "call-popup");

    await popup.locator("[data-tk=call-main]").click();
    await expect(popup).toHaveAttribute("data-step", "buy");
    await expect(popup.locator("h2")).toHaveText("Buy call credits");
    await expect(popup.locator("[data-tk=call-pack]")).toHaveCount(4);
    await expect(popup.locator("[data-tk=call-custom]")).toBeVisible();
    await expect(popup.locator('[role="tablist"]')).toHaveCount(0);
    expect(await popup.innerText()).not.toMatch(BANNED);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "buy-call-credits");

    await popup.locator("[data-tk=call-pay]").click();
    await page.waitForURL(/\/pay\/checkout\//);
    await page.locator("[data-tk=checkout-pay]").click();
    await page.waitForURL((url) => url.pathname === new URL(adUrl).pathname, { timeout: 30_000 });

    const back = page.locator("[data-tk=ad-popup]");
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("data-step", "call");
    await expect(back.locator("[data-tk=call-paid]")).toHaveText(/^Recharge successful, \d+ call credits added$/);
    await expect(back.locator("[data-tk=call-main]")).toHaveText("Start video call");
    await expect(back.locator("[data-tk=call-main]")).toBeEnabled();
    expect(Number(await back.locator("[data-tk=call-balance]").innerText())).toBeGreaterThanOrEqual(COINS);
    // The flags are gone from the address, and the page shows no second "credits added" message.
    expect(page.url()).not.toMatch(/call=|paid=|added=|recharge=/);
    await expect(page.locator("[data-tk=recharge-result]")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "back-and-ready");
  });

  test("a failed or cancelled payment returns to the same ad without a paid line", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "callcancel");
    await api.dispose();
    await loginUi(page, email);
    const path = await realAdPath(page, FEED);
    await setSellerAvailable(slugFromAdPath(path), true);
    await promote(slugFromAdPath(path));
    await page.goto(path);
    const adPathName = new URL(page.url()).pathname;
    await tourButton(page).click();
    const popup = page.locator("[data-tk=ad-popup]");
    await popup.locator("[data-tk=call-main]").click();
    await popup.locator("[data-tk=call-pay]").click();
    await page.waitForURL(/\/pay\/checkout\//);
    await page.locator("[data-tk=checkout-cancel]").click();
    await page.waitForURL((url) => url.pathname === adPathName, { timeout: 30_000 });
    await expect(page.locator("[data-tk=call-paid]")).toHaveCount(0);
  });

  test("the header credit chip shows both balances in a tooltip", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "chiptip");
    await api.dispose();
    await loginUi(page, email);
    await page.goto("/");
    const chip = page.locator("[data-tk=header-coins]");
    await expect(chip).toBeVisible();
    const tip = page.locator("[data-tk=header-coins-tip]");
    if (isPhone(page)) await chip.click();
    else await chip.hover();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/Call credits: \d+ · Ad credits: \d+/);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "chip-tooltip");
  });
});

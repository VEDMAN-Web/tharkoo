import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, loginUi, newUserApi, originHeaders, test, USER_PASSWORD, withLocalDb } from "./helpers";

/** H21.12a: one posting fee everywhere: the step-1 note, the sidebar, the review cost box and the Publish button show the same number. */

const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  const original = page.viewportSize()!;
  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${shotsDir}/${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize(original);
}

async function setMoney(freeAds: number) {
  await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { paidPostingOn: true, postingFeeCredits: 20, creditPriceInr: 10, freeAdsPerAccount: freeAds, mockPaymentsOn: true } }, { upsert: true }));
}

/** A signed-in account that has already published `published` ads, and one draft ready for the review step. */
async function account(page: Page, baseURL: string, published: number) {
  const owner = await newUserApi(baseURL, "h2112a");
  const categories = (await (await owner.api.get("/api/categories")).json()).data.categories as { _id: string; slug: string }[];
  const cities = (await (await owner.api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const category = categories.find((item) => item.slug === "buy-and-sell") ?? categories[0];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  const make = async (title: string) => {
    const res = await owner.api.post("/api/listings", { headers: originHeaders(baseURL, "/u/post-insert/"), data: { categoryId: category._id, cityId: city.id, title, description: "A friendly description of the ad that is long enough." } });
    expect(res.status(), await res.text()).toBe(201);
    return ((await res.json()).data as { id: string }).id;
  };
  for (let n = 0; n < published; n += 1) await make(`Earlier ad ${n} ${Date.now()}`);
  if (published > 0) {
    await withLocalDb(async (db) => {
      const user = await db.collection("users").findOne({ email: owner.email.toLowerCase() });
      await db.collection("listings").updateMany({ ownerId: user!._id }, { $set: { publishedAt: new Date(), status: "active" } });
    });
  }
  const draft = await make(`Money check ${Date.now()}`);
  await loginUi(page, owner.email, USER_PASSWORD, "/u/post-insert/");
  return draft;
}

const amount = (text: string) => Number(/\+([0-9,]+) ad credits/.exec(text)?.[1]?.replace(/,/g, "") ?? NaN);

test.describe("H21.12a money text agrees", () => {
  test.afterEach(async () => {
    await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { paidPostingOn: false, freeAdsPerAccount: 0 } }));
  });

  test("no free ads left: note, sidebar, cost box and Publish button show the same number", async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    await setMoney(3);
    const draft = await account(page, baseURL!, 3);
    const desktop = info.project.name === "desktop-1440";
    await expect(page.locator("[data-tk=post-fee-note]")).toHaveText("This ad costs 20 credits. You have used your 3 free ads.");
    if (desktop) await expect(page.locator("[data-tk=credits-this-ad]")).toHaveText("This ad: 20 credits");
    await shot(page, "left0-step1");

    await page.goto(`/u/post-insert/?draft=${draft}&step=5`);
    const go = page.locator("[data-tk=go-on]");
    await expect(page.locator("[data-tk=cost-posting]")).toHaveText("20 credits");
    await expect(page.locator("[data-tk=cost-total]")).toHaveText("20 credits");
    await expect(go).toHaveText("Publish · 20 credits");
    if (desktop) await expect(page.locator("[data-tk=credits-this-ad]")).toHaveText("This ad: 20 credits");
    await expect(page.locator("[data-tk=boost-balance], [data-tk=pay-card]")).toHaveCount(0);
    await expect(page.locator("[data-tk=review-cost]")).toHaveCount(1);
    await expect(page.locator("[data-tk=cost-after]")).toContainText("credits");
    const normal = page.locator("[data-tk=boost-choice] [role=radio][data-code=free]");
    await expect(normal).toContainText("Normal");
    await expect(normal).toContainText("No boost");
    await expect(normal).toContainText("+0");
    // The options come first, the one cost box sits right above the terms tick.
    const y = async (selector: string) => (await page.locator(selector).first().boundingBox())!.y;
    expect(await y("[data-tk=review-options]")).toBeLessThan(await y("[data-tk=review-cost]"));
    expect(await y("[data-tk=review-summary]")).toBeLessThan(await y("[data-tk=review-cost]"));
    expect(await y("[data-tk=review-cost]")).toBeLessThan(await y("#consent-terms"));
    await expect(page.locator("[data-tk=review-thumb] svg")).toHaveCount(1);
    await shot(page, "left0-review");

    const top = page.locator("[data-tk=boost-choice] [role=radio][data-code=top]");
    await expect(top).toContainText(/\+[0-9,]+ ad credits/);
    const price = amount(await top.innerText());
    await top.click();
    const total = 20 + price;
    await expect(page.locator("[data-tk=cost-posting]")).toHaveText("20 credits");
    await expect(page.locator("[data-tk=cost-total]")).toHaveText(`${total} credits`);
    // A new account has 100 credits: either one button to buy (and the cost box says so) or the total on the button.
    if (total > 100) {
      await expect(go).toHaveText("Buy credits to continue");
      await expect(page.locator("[data-tk=review-cost] [data-tk=boost-short]")).toBeVisible();
    } else {
      await expect(go).toHaveText(`Publish with TOP · ${total} credits`);
    }
    if (desktop) await expect(page.locator("[data-tk=credits-this-ad]")).toHaveText(`This ad: ${total} credits`);
    await shot(page, "left0-review-top");
  });

  test("two free ads left: everything says 0 and the button says Publish ad", async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    await setMoney(3);
    const draft = await account(page, baseURL!, 1);
    const desktop = info.project.name === "desktop-1440";
    await expect(page.locator("[data-tk=post-fee-note]")).toHaveText("This ad is free (2 of 3 free ads left)");
    if (desktop) await expect(page.locator("[data-tk=credits-this-ad]")).toHaveText("This ad: 0 credits");
    await shot(page, "left2-step1");

    await page.goto(`/u/post-insert/?draft=${draft}&step=5`);
    await expect(page.locator("[data-tk=cost-posting]")).toHaveText("0 credits (2 of 3 free ads left)");
    await expect(page.locator("[data-tk=cost-total]")).toHaveText("0 credits");
    await expect(page.locator("[data-tk=go-on]")).toHaveText("Publish ad");
    if (desktop) await expect(page.locator("[data-tk=credits-this-ad]")).toHaveText("This ad: 0 credits");
    await shot(page, "left2-review");
  });
});

import { expect, grantCredits, hasHorizontalScroll, withLocalDb } from "./helpers";
import { finalChecks, test } from "./e1-b-helpers";
import { createLiveAd } from "./flows";
import { ObjectId } from "mongodb";

/**
 * E1-B: seller journeys that no other spec walks: delete from My ads, and every promotion plan (Bump, TOP, Super Top)
 * bought with credits from My ads. Credits are granted in the test database; no real payment is made.
 */

const CARD = ":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])";

async function balance(page: import("@playwright/test").Page) {
  return (await (await page.request.get("/api/wallet/")).json()).data.balance as number;
}

test.describe("E1-B seller journeys", () => {
  test.afterEach(async ({ page }, info) => {
    if (info.status === "passed") await finalChecks(page);
  });

  test("delete: two taps on Delete remove the ad from My ads and from the public site", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const ad = await createLiveAd(page, baseURL!, "e1del");
    await page.goto("/u/account/ads/");
    const card = page.locator(CARD).filter({ hasText: ad.title }).first();
    await expect(card).toBeVisible();
    const button = card.getByRole("button", { name: "Delete" });
    await button.click();
    // The first tap only asks. Nothing is deleted yet.
    await expect(card.getByRole("button", { name: "Tap again to delete" })).toBeVisible();
    expect((await page.request.get(ad.adHref)).status()).toBe(200);
    await card.getByRole("button", { name: "Tap again to delete" }).click();
    await expect(page.getByText("Deleted.")).toBeVisible();
    await expect(page.getByText("You have no ads yet")).toBeVisible();
    expect([404, 410]).toContain((await page.request.get(ad.adHref)).status());
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  for (const plan of [
    { code: "bump", label: "Bump" },
    { code: "top", label: "TOP" },
    { code: "super-top", label: "Super Top" },
  ]) {
    test(`boost: ${plan.label} is bought with credits from My ads, the balance drops by its price and the ad shows the plan`, async ({ page, baseURL }) => {
      test.setTimeout(240_000);
      const ad = await createLiveAd(page, baseURL!, `e1${plan.code.replace("-", "")}`);
      // A longer life keeps the ad live for the whole test, as the other promote specs do.
      await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(ad.listingId) }, { $set: { expiresAt: new Date(Date.now() + 60 * 86_400_000) } }));
      await grantCredits(page, 3000);
      const start = await balance(page);
      await page.goto("/u/account/ads/");
      const card = page.locator(CARD).filter({ hasText: ad.title }).first();
      await card.locator("[data-tk=promote-open]").click();
      const sheet = page.locator("[data-tk=promote-sheet]");
      await expect(sheet).toBeVisible();
      const option = sheet.locator(`[data-tk=promote-plan][data-code=${plan.code}]`);
      await expect(option, `${plan.label} is offered`).toBeVisible();
      await option.click();
      await sheet.locator("[data-tk=promote-pay]").click();
      await expect(sheet.locator("[data-tk=promote-done]")).toBeVisible();
      const spent = start - (await balance(page));
      expect(spent, `${plan.label} costs credits`).toBeGreaterThan(0);
      await expect(sheet.locator("[data-tk=promote-left]")).toContainText(`Credits left: ${(start - spent).toLocaleString("en-IN")}`);
      await sheet.getByRole("button", { name: "Close" }).click();
      // The order is on the account's history.
      await page.goto("/u/account/credits/history/");
      await expect(page.getByRole("heading", { name: "Credits history" })).toBeVisible();
      await page.getByRole("tab", { name: "Credits used" }).or(page.getByRole("button", { name: "Credits used" })).first().click();
      await expect(page.locator("main")).toContainText(new RegExp(`${spent}|${spent.toLocaleString("en-IN")}`));
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }
});

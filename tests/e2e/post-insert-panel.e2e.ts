import type { Page } from "@playwright/test";
import { createLiveAd } from "./flows";
import { expect, isPhone, loginUi, newApi, registerApi, test, uniqueEmail, USER_PASSWORD } from "./helpers";

/** No horizontal page scroll at the current viewport (phone 390, desktop 1440). */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);
}

test.describe("H6.19 post an ad and the vendor panel", () => {
  test("post an ad end to end, then the vendor home shows it as a shared card in Your ads", async ({ page, baseURL }) => {
    test.setTimeout(150_000);
    const base = baseURL!;
    // createLiveAd fills the five steps (category, details, photos, contact, review) and publishes.
    const ad = await createLiveAd(page, base, "panel");

    await page.goto("/u/account/");
    await expect(page.locator("h1")).toHaveCount(1);
    const card = page.locator("[data-tk=own-list] [data-tk=card]").filter({ hasText: ad.title }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    // The shared listing card carries the status label and the owner actions.
    await expect(card.locator("[data-tk=owner-status]")).toHaveText(/Live|Ending soon|In review/);
    await expect(card.locator("[data-tk=owner-actions]").getByRole("link", { name: "Edit" })).toBeVisible();
    await expect(card.locator("[data-tk=owner-actions]").getByRole("button", { name: "Renew" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("the post-ad form shows the five steps in order", async ({ page, baseURL }) => {
    const base = baseURL!;
    const email = uniqueEmail("steps");
    const signup = await newApi(base);
    await registerApi(signup, base, email);
    await signup.dispose();

    await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
    await page.waitForURL(/\/u\/post-insert\//);
    const labels = page.locator("[data-tk=progress] li");
    await expect(labels).toHaveCount(5);
    await expect(labels.nth(0)).toContainText(/Category/);
    await expect(labels.nth(1)).toContainText(/Details/);
    await expect(labels.nth(2)).toContainText(/Photos/);
    await expect(labels.nth(3)).toContainText(/Contact/);
    await expect(labels.nth(4)).toContainText(/Review/);
    // The live preview is on the page; on a phone it sits under the form at the review step instead.
    await expect(page.locator("[data-tk=post-preview]").first()).toBeAttached();
    await expectNoHorizontalScroll(page);
    if (isPhone(page)) await expect(page.locator(".tk-post-aside")).toBeHidden();
  });
});

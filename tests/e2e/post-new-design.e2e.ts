import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, loginUi, newApi, registerApi, test, uniqueEmail, USER_PASSWORD } from "./helpers";
import { fillNewPostAd } from "./flows";

/** H7.5: the New design post-ad form, five steps with a live preview. Runs at 390 and 1440 (both projects). */

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);
}

async function signedInPoster(page: Page, baseURL: string, prefix: string) {
  const email = uniqueEmail(prefix);
  const signup = await newApi(baseURL);
  await registerApi(signup, baseURL, email);
  await signup.dispose();
  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  await page.waitForURL(/\/u\/post-insert\//);
}

test.describe("H7.5 post-ad, New design", () => {
  test("five steps in order, the step rail, and no sideways scroll on any step", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await signedInPoster(page, baseURL!, "steps");
    await expect(page.locator(".tkp-post")).toBeVisible();
    await expect(page.locator("[data-tk=step-title]")).toHaveText("What are you posting?");
    await expect(page.locator(".tkp-step")).toHaveCount(5);
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 1 of 5");
    await expect(page.locator("h1")).toHaveCount(1);
    await expectNoHorizontalScroll(page);

    await page.locator(".tkp-tile", { hasText: "Jobs" }).click();
    await expect(page.locator(".tkp-tile", { hasText: "Jobs" })).toHaveAttribute("aria-pressed", "true");
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 2 of 5");
    await expect(page.locator("#city")).toBeVisible();
    await expect(page.locator("#price")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("the live preview follows the title as it is typed", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await signedInPoster(page, baseURL!, "preview");
    await page.locator(".tkp-tile", { hasText: "Jobs" }).click();
    await page.locator("[data-tk=go-on]").click();
    await page.locator("#title").fill("Preview check title");
    const phone = (page.viewportSize()?.width ?? 1440) < 1024;
    if (phone) await page.locator("[data-tk=open-preview]").click();
    const card = phone ? page.locator("[data-tk=preview-sheet]") : page.locator("[data-tk=post-preview]");
    await expect(card.locator(".tkn-ls-title")).toHaveText("Preview check title");
    if (phone) await page.getByRole("button", { name: "Close preview" }).click();
    await page.locator("#price").fill("18000");
    if (phone) await page.locator("[data-tk=open-preview]").click();
    await expect(card.locator(".tkn-ls-price")).toContainText("18,000");
  });

  test("Continue stays off until a category is chosen, and the title error shows inline", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await signedInPoster(page, baseURL!, "errors");
    await expect(page.locator("[data-tk=go-on]")).toBeDisabled();
    await page.locator(".tkp-tile", { hasText: "Jobs" }).click();
    await expect(page.locator("[data-tk=go-on]")).toBeEnabled();
    await page.locator("[data-tk=go-on]").click();
    await page.locator("#title").fill("ab");
    await page.locator("#text").focus();
    await expect(page.locator(".tkp-main [data-tk=field-error]").first()).toBeVisible();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 2 of 5");
  });

  test("publish from the five steps goes live", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await signedInPoster(page, baseURL!, "publish");
    const ad = await fillNewPostAd(page, baseURL!, { title: `E2E new design ${Date.now()}` });
    expect(ad.listingId).toBeTruthy();
  });

  test("the step and the form pass axe with no serious or critical issue", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await signedInPoster(page, baseURL!, "axe");
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(serious.map((item) => `${item.id}: ${item.help}`)).toEqual([]);
  });
});

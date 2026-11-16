import type { Page } from "@playwright/test";
import { expect, loginUi, newApi, registerApi, setIdCheckSwitch, test, uniqueEmail, USER_PASSWORD } from "./helpers";
import { fillNewPostAd } from "./flows";

/** No horizontal page scroll at the current viewport (phone 390, desktop 1440). */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);
}

test.describe("H6.14 ID-check switch on post-ad", () => {
  // The switch is shared by the whole suite, so every test in this file leaves it off.
  test.afterEach(async ({ baseURL }) => {
    await setIdCheckSwitch(baseURL!, false);
  });

  test("off: post-ad reaches submit and publishes with no ID check", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const base = baseURL!;
    const title = `E2E no id check ${Date.now()}`;
    await setIdCheckSwitch(base, false);
    const email = uniqueEmail("noid");
    const signup = await newApi(base);
    await registerApi(signup, base, email);
    await signup.dispose();

    await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
    await page.waitForURL(/\/u\/post-insert\//);
    // The form opens straight away: no check-first screen, no Verify ID link.
    await expect(page.locator("[data-tk=step-title]")).toHaveText("What are you posting?");
    await expect(page.locator("[data-tk=id-check-first]")).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await fillNewPostAd(page, base, { title });
    await expect(page.locator("[data-tk=verify-id]")).toHaveCount(0);
    await expect(page.locator("[aria-live=polite]").filter({ hasText: /quick check/i })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("on: the ID check comes first, before step 1, and the form stays closed", async ({ page, baseURL }) => {
    const base = baseURL!;
    await setIdCheckSwitch(base, true);
    const email = uniqueEmail("idfirst");
    const signup = await newApi(base);
    await registerApi(signup, base, email);
    await signup.dispose();

    await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
    await page.waitForURL(/\/u\/post-insert\//);
    await expect(page.locator("[data-tk=id-check-first] [data-tk=step-title]")).toContainText(/verify your id first/i);
    await expect(page.locator("[data-tk=verify-id]")).toHaveAttribute("href", /\/u\/account\/kyc/);
    await expect(page.locator("#category")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});

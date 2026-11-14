import type { Page } from "@playwright/test";
import { expect, loginUi, newApi, PNG, registerApi, setIdCheckSwitch, test, uniqueEmail, USER_PASSWORD } from "./helpers";

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
    await expect(page.locator("[data-tk=step-title]")).toContainText(/information/i);
    await expect(page.locator("[data-tk=id-check-first]")).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await page.locator("#category").selectOption({ label: "Jobs" });
    await page.locator("#city").selectOption({ label: "Mumbai" });
    await page.locator("#nickname").fill("Asha");
    await page.locator("#role").fill("Office assistant");
    await page.locator("#title").fill(title);
    await page.locator("#text").fill("A weekday office role with a clear description of the work and the hours.");
    await page.locator("#phone").fill("9876543210");
    await page.locator("#consent-terms").check();
    await page.locator("#consent-adult").check();
    await page.locator("[data-tk=go-on]").click();

    await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
    await page.locator("[data-tk=photo-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.locator("[data-tk=photo-note]")).toContainText(/Photo saved/i);
    await page.locator("[data-tk=go-on]").click();

    // Submit goes through without any ID check.
    await page.locator("button", { hasText: "PUBLISH" }).click();
    await expect(page.locator("[data-tk=step-title]").filter({ hasText: /live/i })).toBeVisible();
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

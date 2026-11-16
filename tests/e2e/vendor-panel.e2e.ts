import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { becomeSeller, expect, loginUi, newApi, registerApi, test, uniqueEmail, USER_PASSWORD } from "./helpers";
import { createLiveAd } from "./flows";

/** H7.5: the New design seller panel and the "Available now" switch. Runs at 390 and 1440 (both projects). */

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);
}

async function signedInSeller(page: Page, baseURL: string, prefix: string) {
  const email = uniqueEmail(prefix);
  const signup = await newApi(baseURL);
  await registerApi(signup, baseURL, email);
  await signup.dispose();
  await loginUi(page, email, USER_PASSWORD, "/u/account/");
  // A seller sees the seller panel: the account page branches on the saved seller profile (H7.2b).
  await becomeSeller(page, baseURL);
  await page.reload();
  await page.waitForURL(/\/u\/account\//);
}

function availableNow(page: Page) {
  return page.getByRole("button", { name: /^Available now/ });
}

test.describe("H7.5 seller panel, New design", () => {
  test("the panel shows the switch, the numbers and My ads; no sideways scroll", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await signedInSeller(page, baseURL!, "panel");
    await expect(page.locator(".tkv-page")).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(availableNow(page)).toHaveAttribute("aria-pressed", /^(true|false)$/);
    await expect(page.locator(".tkv-stats")).toContainText("Live ads");
    await expect(page.locator("#tkv-ads-title")).toHaveText("My ads");
    await expectNoHorizontalScroll(page);
  });

  test("Available now drives the status buyers see, and turns back off", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await signedInSeller(page, baseURL!, "avail");
    const me = await page.request.get("/api/auth/me");
    const userId = ((await me.json()).data?.user?.id || "") as string;
    expect(userId).toBeTruthy();

    const startsOn = (await availableNow(page).getAttribute("aria-pressed")) === "true";

    async function flipAndExpect(wantOn: boolean) {
      await availableNow(page).click();
      await expect(availableNow(page)).toHaveAttribute("aria-pressed", String(wantOn));
      const res = await page.request.get(`/api/availability/status/${userId}`);
      const data = (await res.json()).data as { status: string; callsAllowed: boolean };
      if (wantOn) expect(data.status).toBe("online");
      else expect(data).toMatchObject({ status: "away", callsAllowed: false });
    }

    await flipAndExpect(!startsOn);
    await flipAndExpect(startsOn);
    await expectNoHorizontalScroll(page);
  });

  test("a published ad shows in My ads with its status and the owner's counts", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const ad = await createLiveAd(page, baseURL!, "owner");
    await page.goto("/u/account/ads/");
    const card = page.locator("[data-tk=owner-card]").first();
    await expect(card).toBeVisible();
    await expect(card).toContainText("Live");
    await expect(card).toContainText("views");
    await expect(page.locator(".tkv-tab", { hasText: "Live" })).toBeVisible();
    expect(ad.listingId).toBeTruthy();
    await expectNoHorizontalScroll(page);
  });

  test("the seller panel passes axe with no serious or critical issue", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await signedInSeller(page, baseURL!, "axe");
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(serious.map((item) => `${item.id}: ${item.help}`)).toEqual([]);
  });
});

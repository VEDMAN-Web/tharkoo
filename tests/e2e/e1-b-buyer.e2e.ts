import { expect, hasHorizontalScroll, loginUi, newUserApi } from "./helpers";
import { finalChecks, test } from "./e1-b-helpers";

/**
 * E1-B: buyer journeys: save an ad and find it in Saved ads, and the notifications page of an
 * account that has nothing yet. (Chats between two accounts are walked by h7-131-chat-flows.)
 */

const ROW = ":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])";

test.describe("E1-B buyer journeys", () => {
  test.afterEach(async ({ page }, info) => {
    if (info.status === "passed") await finalChecks(page);
  });

  test("saved ads: the heart on a listing saves the ad, Saved ads lists it on this device, and the heart on the listing takes it off", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { email, api } = await newUserApi(baseURL!, "e1saved");
    await api.dispose();
    await loginUi(page, email);
    await page.goto("/jobs/mumbai/");
    const row = page.locator(ROW).first();
    await expect(row).toBeVisible();
    const title = (await row.locator(".tk-row-title, .tkh-ad-title, .tk-card-title").first().innerText()).trim();
    const heart = row.locator("button[aria-pressed]").first();
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    // The save reaches the account, not only this browser: the server list has it.
    await expect.poll(async () => JSON.stringify((await (await page.request.get("/api/saved/")).json()).data ?? {}), { timeout: 15_000 }).toContain(title.slice(0, 12));
    await page.goto("/u/account/saved/");
    await expect(page.getByRole("heading", { name: "Saved ads" }).first()).toBeVisible();
    await expect(page.locator("main")).toContainText(title);
    expect(await hasHorizontalScroll(page)).toBe(false);
    // Take it off again with the heart on the listing, and the page is empty again.
    await page.goto("/jobs/mumbai/");
    const again = page.locator(ROW).first().locator("button[aria-pressed]").first();
    await expect(again).toHaveAttribute("aria-pressed", "true");
    await again.click();
    await expect(again).toHaveAttribute("aria-pressed", "false");
    await page.goto("/u/account/saved/");
    await expect(page.getByText("Nothing saved yet")).toBeVisible();
  });

  test("notifications: a new account sees the empty page, and the page works at this size", async ({ page, baseURL }) => {
    const { email, api } = await newUserApi(baseURL!, "e1notes");
    await api.dispose();
    await loginUi(page, email, undefined, "/u/account/notifications/");
    await expect(page.getByRole("heading", { name: /notifications/i }).first()).toBeVisible();
    await expect(page.getByText("No notifications yet")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

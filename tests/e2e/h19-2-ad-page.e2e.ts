import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, realAdPath, test, withLocalDb } from "./helpers";

/**
 * H19.2: the ad page. A guest sees the contact buttons and Chat opens sign-in on the same ad; no sample box; the breadcrumb is
 * Tharkoo India / City / Area; four similar ads two by two; the vendor on their own ad sees Edit and Boost, not Chat or Video call.
 * Set SHOTS_DIR to also save a screenshot of each page.
 */

const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: `${shotsDir}/${name}-${page.viewportSize()?.width ?? 0}.png`, fullPage: false });
}

test.describe("H19.2 ad page", () => {
  test("a guest sees Call, WhatsApp and Chat, and Chat opens sign-in on the same ad", async ({ page }, testInfo) => {
    const path = await realAdPath(page);
    await page.goto(path);
    const scope = testInfo.project.name === "phone-390" ? '[data-tk="bottom-bar"]' : '[data-tk="contact-card"]';
    const here = new URL(page.url()).pathname;
    await expect(page.locator(`${scope} [data-tk="call"], [data-tk="bottom-bar"] [data-tk="call"]`).first()).toBeAttached();
    await expect(page.locator(`${scope} [data-tk="whatsapp"]`)).toBeVisible();
    const chat = page.locator(`${scope} [data-tk="chat"]`);
    await expect(chat).toBeVisible();
    await shot(page, "guest-contact");
    await chat.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(new URL(page.url()).pathname, "still on the same ad").toBe(here);
    await shot(page, "guest-chat-signin");
  });

  test("the sample box is gone from a sample ad", async ({ page }) => {
    await page.goto("/ad/demo-0352/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('[data-tk="sample-banner"]')).toHaveCount(0);
    await expect(page.getByText("showing how ads look on Tharkoo")).toHaveCount(0);
  });

  test("the breadcrumb is Tharkoo India / City / Area and the category is not glued to the city", async ({ page }) => {
    await page.goto(await realAdPath(page, "/dating/bengaluru/"));
    const nav = page.locator(".tkn-ad-crumbs");
    const text = (await nav.innerText()).replace(/\s+/g, " ").trim();
    expect(text).toMatch(/^Tharkoo India \/ Bengaluru( \/ [A-Za-z ]+)?$/);
    expect(text).not.toMatch(/Bengaluru (Dating|Friendship|Meetups|Personal ads|Jobs|Wellness)/);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "crumbs");
  });

  test("similar ads: four cards, two by two", async ({ page }) => {
    await page.goto(await realAdPath(page, "/property/bengaluru/"));
    const section = page.locator('[data-tk="similar-ads"]');
    await section.scrollIntoViewIfNeeded();
    const cards = section.locator('[data-tk="home-ad"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
    const one = (await cards.nth(0).boundingBox())!;
    const two = (await cards.nth(1).boundingBox())!;
    expect(Math.abs(one.y - two.y)).toBeLessThanOrEqual(2);
    expect(two.x).toBeGreaterThan(one.x);
    if (count > 2) expect((await cards.nth(2).boundingBox())!.y).toBeGreaterThan(one.y + one.height - 2);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "similar");
  });

  test("the vendor on their own ad sees This is your ad, Edit and Boost, and no Chat or Video call", async ({ page }, testInfo) => {
    const path = await realAdPath(page);
    const slug = path.replace(/^\/ad\//, "").replace(/\/$/, "");
    const { email } = await newUserApi(String(testInfo.project.use.baseURL || "http://127.0.0.1:4342"), "h192own");
    await withLocalDb(async (db) => {
      const user = await db.collection("users").findOne({ email });
      await db.collection("listings").updateOne({ slug }, { $set: { ownerId: user!._id } });
    });
    await loginUi(page, email, undefined, path);
    const owner = page.locator('[data-tk="owner-actions"]:visible').first();
    await expect(owner).toBeVisible();
    await expect(owner).toContainText("This is your ad");
    await expect(owner.getByRole("link", { name: "Edit" })).toBeVisible();
    await expect(owner.getByRole("button", { name: "Boost" })).toBeVisible();
    await expect(page.locator('[data-tk="chat"], [data-tk="tour"], [data-tk="call"], [data-tk="whatsapp"]')).toHaveCount(0);
    await shot(page, "owner");
  });
});

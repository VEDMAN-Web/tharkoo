import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, hasHorizontalScroll, isPhone, signInAdminContext, test } from "./helpers";

/** H6.17: card width on listing pages. Default medium (880 px). Phones are unchanged. */

const SHOTS = join(process.cwd(), ".shots", "H6.17");
const FEED = "/dating/bengaluru/";

test.describe("H6.17 card width", () => {
  test("the ad card grid is at most 904 px wide on desktop, and fits a phone with no sideways scroll", async ({ page }, testInfo) => {
    mkdirSync(SHOTS, { recursive: true });
    await page.goto(FEED);
    const feed = page.locator('[data-tk="listing-grid"]').first();
    await feed.waitFor({ state: "attached" });
    await expect(page.locator("[data-card-width]").first()).toHaveAttribute("data-card-width", /^(narrow|medium|full)$/);
    const box = await feed.boundingBox();
    expect(box).toBeTruthy();
    if (isPhone(page)) {
      expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(await hasHorizontalScroll(page)).toBe(false);
    } else {
      expect(box!.width).toBeLessThanOrEqual(904.5);
    }
    await page.screenshot({ path: join(SHOTS, `card-width-${testInfo.project.name}.png`), fullPage: false });
  });

  test("an admin changes the card width to narrow, and the list follows", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin setting runs once, at desktop width");
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/page-builder/?tab=listing");
    await page.getByLabel("Narrow (760 px)").check();
    await page.getByRole("region", { name: "Save changes" }).getByRole("button", { name: "Publish" }).click();
    await page.getByRole("dialog", { name: "Publish" }).getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText(/Published as version \d+/)).toBeVisible();

    await page.goto(FEED);
    const feed = page.locator('[data-tk="listing-grid"]').first();
    await feed.waitFor({ state: "attached" });
    await expect(page.locator("[data-card-width]").first()).toHaveAttribute("data-card-width", "narrow");
    const box = await feed.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(760.5);

    // Put it back to the default so the other tests see medium.
    await page.goto("/admin/page-builder/?tab=listing");
    await page.getByLabel("Medium (880 px, default)").check();
    await page.getByRole("region", { name: "Save changes" }).getByRole("button", { name: "Publish" }).click();
    await page.getByRole("dialog", { name: "Publish" }).getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText(/Published as version \d+/)).toBeVisible();
  });
});

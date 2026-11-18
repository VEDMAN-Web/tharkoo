import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { becomeSeller, expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, test } from "./helpers";

/** H9.7: the seller profile switches are the same switches as the Account home, and a wrong coupon code gets a friendly sentence. */

const SHOTS = process.env.H97_SHOTS_DIR ?? "";
const COUPON_TEXT = "We couldn't find that coupon. Check the code and try again.";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("H9.7 switches and the coupon sentence", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("on the seller profile, Available now and Live chat are switches with a track, a benefit line, keyboard and screen reader support (1440 and 390)", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const { email } = await newUserApi(baseURL!, "h97switch");
    await loginUi(page, email, undefined, "/u/seller-profile/?next=/u/account/");
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/u/seller-profile/?next=/u/account/");
      const form = page.locator('[data-tk="seller-profile"]');
      const rows = form.locator('[data-tk="sp-switch"]');
      await expect(rows).toHaveCount(2);
      await expect(rows.locator(".tkv-switch")).toHaveCount(2);
      // The same look as the Account home: the row is a tkv-avail card with a 54 x 32 track.
      const track = await rows.first().locator(".tkv-switch").boundingBox();
      expect(Math.round(track?.width ?? 0)).toBe(54);
      expect(Math.round(track?.height ?? 0)).toBe(32);
      const now = form.getByRole("switch", { name: /Available now/ });
      await expect(now).toHaveCount(1);
      await expect(now).not.toBeChecked();
      await expect(form.getByText("People see Online now on your ads.")).toBeVisible();
      // Keyboard: Tab to it and press Space.
      await now.focus();
      await page.keyboard.press("Space");
      await expect(now).toBeChecked();
      await expect(rows.first()).toHaveClass(/is-on/);
      // The track turns green (it fades, so wait for it).
      await expect.poll(async () => await rows.first().locator(".tkv-switch").evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(4, 120, 87)");
      await page.keyboard.press("Space");
      await expect(now).not.toBeChecked();
      await expect(rows.first()).not.toHaveClass(/is-on/);
      // A tap anywhere on the row turns it on.
      await rows.nth(1).click();
      await expect(form.getByRole("switch", { name: /Live chat/ })).toBeChecked();
      await rows.nth(1).click();
      for (let index = 0; index < 2; index += 1) {
        const box = await rows.nth(index).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "seller-profile-switches");
    }
  });

  test("a wrong coupon code says: We couldn't find that coupon. Check the code and try again. (1440 and 390)", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const { email } = await newUserApi(baseURL!, "h97coupon");
    await loginUi(page, email, undefined, "/u/account/");
    await becomeSeller(page, baseURL!);
    const res = await page.request.post("/api/coupons/redeem", { headers: originHeaders(baseURL!, "/u/account/"), data: { code: "no-such-code" } });
    expect(res.status()).toBe(404);
    expect((await res.json()).error.message).toBe(COUPON_TEXT);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/u/account/coupons/");
      await page.locator("#coupon-code").fill("no-such-code");
      await page.locator('[data-tk="apply-coupon"]').click();
      await expect(page.getByText(COUPON_TEXT)).toBeVisible();
      await expect(page.getByText("Coupon is invalid")).toHaveCount(0);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "coupon-error");
    }
  });
});

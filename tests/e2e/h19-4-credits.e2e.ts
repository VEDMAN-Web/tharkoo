import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test } from "./helpers";

/**
 * H19.4: a recharge sheet opened for calls shows call packs only (no tabs, no ad wording), one opened for posting shows ad packs only,
 * the wallet page shows both kinds as two tabs, and the packs are a tidy grid. Set SHOTS_DIR to save screenshots.
 */

const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: `${shotsDir}/${name}-${page.viewportSize()?.width ?? 0}.png`, fullPage: true });
  const size = page.viewportSize();
  if (size && size.width === 390) {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: `${shotsDir}/${name}-768.png`, fullPage: true });
    await page.setViewportSize(size);
  }
}

const open = async (page: Page, detail: Record<string, unknown>) => {
  // The sheet host listens only once the page has loaded, so ask again until it is there.
  await expect
    .poll(async () => {
      if ((await page.locator('[data-tk="credit-packs"]').count()) === 0) await page.evaluate((options) => window.dispatchEvent(new CustomEvent("tk-recharge-open", { detail: options })), detail);
      return page.locator('[data-tk="credit-packs"]').count();
    }, { timeout: 20_000 })
    .toBeGreaterThan(0);
};

test.describe("H19.4 buying credits", () => {
  test("opened for calls: call packs only, no tabs and no ad wording", async ({ page }, testInfo) => {
    const { email } = await newUserApi(String(testInfo.project.use.baseURL || "http://127.0.0.1:4342"), "h194c");
    await loginUi(page, email, undefined, "/");
    await open(page, { wallet: "call", shortfall: 20 });
    const sheet = page.locator('[data-tk="credit-packs"]');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("data-wallet", "call");
    await expect(page.locator('[data-tk="wallet-tab-call"], [data-tk="wallet-tab-ad"]')).toHaveCount(0);
    const text = (await page.getByRole("dialog").innerText()).toLowerCase();
    for (const word of ["free ads", "to publish", "per ad", "posting", "super top", "for ads"]) expect(text, word).not.toContain(word);
    await expect(page.locator('[data-tk="recharge-pack"], [data-tk="custom-amount"]').first()).toBeVisible();
    await expect(page.locator('[data-tk="recharge-pay"]')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "sheet-call");
  });

  test("opened for posting: ad packs only, no tabs and no call wording", async ({ page }, testInfo) => {
    const { email } = await newUserApi(String(testInfo.project.use.baseURL || "http://127.0.0.1:4342"), "h194a");
    await loginUi(page, email, undefined, "/");
    await open(page, { wallet: "ad", shortfall: 20 });
    const sheet = page.locator('[data-tk="credit-packs"]');
    await expect(sheet).toHaveAttribute("data-wallet", "ad");
    await expect(page.locator('[data-tk="wallet-tab-call"], [data-tk="wallet-tab-ad"]')).toHaveCount(0);
    const text = (await page.getByRole("dialog").innerText()).toLowerCase();
    expect(text).not.toContain("video call");
    expect(text).not.toContain("call credits");
    await shot(page, "sheet-ad");
  });

  test("the wallet page shows both kinds as two tabs, and the posting price card only on the ad tab", async ({ page }, testInfo) => {
    const { email } = await newUserApi(String(testInfo.project.use.baseURL || "http://127.0.0.1:4342"), "h194w");
    await loginUi(page, email, undefined, "/u/account/wallet/");
    await expect(page.locator('[data-tk="wallet-tab-call"]')).toBeVisible();
    await expect(page.locator('[data-tk="wallet-tab-ad"]')).toBeVisible();
    await page.locator('[data-tk="wallet-tab-ad"]').click();
    await shot(page, "wallet-ad");
    await page.locator('[data-tk="wallet-tab-call"]').click();
    await expect(page.locator('[data-tk="credit-packs"]')).toHaveAttribute("data-wallet", "call");
    await expect(page.locator('[data-tk="price-card"], .tkc-card')).toHaveCount(0);
    await shot(page, "wallet-call");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the packs are a grid: two columns on a phone, four on a wide screen", async ({ page }, testInfo) => {
    const { email } = await newUserApi(String(testInfo.project.use.baseURL || "http://127.0.0.1:4342"), "h194g");
    await loginUi(page, email, undefined, "/");
    await open(page, { wallet: "ad" });
    const packs = page.locator('[data-tk="recharge-pack"]');
    await expect(packs.first()).toBeVisible();
    const count = await packs.count();
    const first = (await packs.nth(0).boundingBox())!;
    const second = count > 1 ? (await packs.nth(1).boundingBox())! : null;
    if (second) expect(Math.abs(first.y - second.y), "the first two packs share a row").toBeLessThanOrEqual(2);
    const width = page.viewportSize()!.width;
    if (width >= 900 && count >= 4) expect(Math.abs(first.y - (await packs.nth(3).boundingBox())!.y)).toBeLessThanOrEqual(2);
    if (width < 600 && count >= 3) expect((await packs.nth(2).boundingBox())!.y).toBeGreaterThan(first.y + first.height - 2);
  });
});

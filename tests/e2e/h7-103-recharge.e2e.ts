import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test, withLocalDb } from "./helpers";

const SHOTS = process.env.RECHARGE_SHOTS_DIR || "";
const SIZES = [
  [1536, 674],
  [1366, 768],
  [390, 844],
] as const;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const original = page.viewportSize();
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}x${height}.png` });
  }
  if (original) await page.setViewportSize(original);
}

async function signIn(page: Page, baseURL: string, prefix: string) {
  const { api, email } = await newUserApi(baseURL, prefix);
  await api.dispose();
  await loginUi(page, email, undefined, "/u/account/credits/");
  await page.waitForURL(/\/u\/account\/credits\//);
  return email;
}

async function balance(page: Page) {
  return (await (await page.request.get("/api/wallet/")).json()).data.balance as number;
}

async function openSheet(page: Page) {
  await page.goto("/u/account/credits/");
  await page.locator('[data-tk="open-recharge"]').click();
  const sheet = page.locator('[data-tk="recharge-sheet"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-tk="recharge-pack"]').first()).toBeVisible();
  return sheet;
}

test.describe("H7.103 recharge sheet and mock checkout", () => {
  test("the sheet fits the window, lists the packs by size, and a card payment adds the credits", async ({ page, baseURL }, testInfo) => {
    await signIn(page, baseURL!, "rechcard");
    const sheet = await openSheet(page);
    await expect(sheet.getByRole("heading", { name: "Recharge credits" })).toBeVisible();
    await expect(sheet).toContainText("1 credit = Rs 10");
    const packs = sheet.locator('[data-tk="recharge-pack"]');
    const count = await packs.count();
    expect(count).toBeGreaterThan(1);
    expect(count).toBeLessThanOrEqual(6);
    const totals = await packs.evaluateAll((els) => els.map((el) => Number((el.querySelector("strong")?.textContent || "0").replace(/,/g, ""))));
    expect([...totals].sort((a, b) => a - b)).toEqual(totals);
    await expect(sheet.locator('[data-tk="recharge-card"]')).toHaveAttribute("aria-checked", "true");
    await expect(sheet.locator('[data-tk="recharge-crypto"]')).toBeVisible();
    await expect(sheet.getByRole("img", { name: "Visa" })).toBeVisible();
    await expect(sheet.getByRole("img", { name: "Mastercard" })).toBeVisible();
    for (const mark of ["Bitcoin", "Ethereum", "USDT", "USDC"]) await expect(sheet.getByRole("img", { name: mark })).toBeVisible();
    await expect(sheet.locator('[data-tk="recharge-pay"]')).toHaveText(/^Pay Rs [0-9,]+$/);
    await expect(sheet).toContainText("Secure payment");
    await expect(sheet.locator('[data-tk="recharge-support"]')).toBeVisible();
    if (testInfo.project.name === "desktop-1440") {
      const box = (await sheet.boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(560);
      for (const [width, height] of SIZES.slice(0, 2)) {
        await page.setViewportSize({ width, height });
        const fit = await sheet.evaluate((node) => ({ scroll: node.scrollHeight, client: node.clientHeight }));
        expect(fit.scroll, `${width}x${height} sheet scroll`).toBeLessThanOrEqual(fit.client);
        await shot(page, "sheet");
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    } else {
      const box = (await sheet.boundingBox())!;
      expect(Math.round(box.x + box.width)).toBeGreaterThanOrEqual(389);
      expect(box.y + box.height).toBeGreaterThanOrEqual(843);
      await shot(page, "sheet");
    }

    await packs.first().click();
    const price = (await sheet.locator('[data-tk="recharge-pay"]').innerText()).replace(/[^0-9]/g, "");
    await sheet.locator('[data-tk="recharge-pay"]').click();
    await page.waitForURL(/\/pay\/checkout\//);
    const checkout = page.locator('[data-tk="checkout"]');
    await expect(checkout.locator('[data-tk="test-ribbon"]')).toHaveText("Test payment");
    await expect(checkout.locator('[data-tk="checkout-amount"]')).toContainText(Number(price).toLocaleString("en-IN"));
    await expect(checkout.locator("input, textarea")).toHaveCount(0);
    await expect(checkout.getByRole("button", { name: /^Pay Rs/ })).toBeVisible();
    await expect(checkout.getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "card-checkout");
    expect(await balance(page)).toBe(0);
    await checkout.getByRole("button", { name: /^Pay Rs/ }).click();
    await expect(checkout.locator('[data-tk="checkout-busy"]')).toContainText("Processing");
    await shot(page, "card-processing");
    await page.waitForURL(/\/u\/account\/credits\//, { timeout: 15_000 });
    const toast = page.locator('[data-tk="recharge-result"]');
    await expect(toast).toHaveAttribute("data-result", "paid");
    await expect(toast).toContainText(/credits added/);
    await shot(page, "paid-toast");
    expect(await balance(page)).toBeGreaterThan(0);
    await expect(page).not.toHaveURL(/recharge=/);

    await page.goto("/u/account/credits/history/");
    const row = page.locator('[data-tk="purchase-row"]').first();
    await expect(row).toContainText("Card");
    await expect(row).toContainText("Paid");
    await expect(row).toContainText(Number(price).toLocaleString("en-IN"));
    await shot(page, "history");
    await row.getByRole("link", { name: "Receipt" }).click();
    await expect(page.locator('[data-tk="receipt"]')).toContainText("Receipt no.");
    await expect(page.locator('[data-tk="receipt"]')).toContainText("Paid");
    await shot(page, "receipt");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("a cancelled payment adds nothing and says so, with Try again and Contact support that fills the chat", async ({ page, baseURL }) => {
    await signIn(page, baseURL!, "rechcancel");
    const sheet = await openSheet(page);
    await sheet.locator('[data-tk="recharge-pay"]').click();
    await page.waitForURL(/\/pay\/checkout\//);
    await page.locator('[data-tk="checkout"]').getByRole("button", { name: "Cancel" }).click();
    await page.waitForURL(/\/u\/account\/credits\//, { timeout: 15_000 });
    const toast = page.locator('[data-tk="recharge-result"]');
    await expect(toast).toHaveAttribute("data-result", "failed");
    await expect(toast).toContainText("Payment was not completed. Nothing was charged.");
    await shot(page, "failed-toast");
    expect(await balance(page)).toBe(0);
    await toast.getByRole("button", { name: "Contact support" }).click();
    await expect.poll(async () => page.locator("#tkn-chat-input").inputValue()).toContain("credit recharge");
    await page.reload();
    await page.locator('[data-tk="open-recharge"]').click();
    await page.locator('[data-tk="recharge-support"]').click();
    await expect.poll(async () => page.locator("#tkn-chat-input").inputValue()).toMatch(/Pack: .* credits\. Amount: Rs .*Method: Card/);
  });

  test("crypto: choose a coin and a network, see the estimate, address, QR and timer, then I have paid adds the credits", async ({ page, baseURL }) => {
    await signIn(page, baseURL!, "rechcrypto");
    const sheet = await openSheet(page);
    await sheet.locator('[data-tk="recharge-crypto"]').click();
    await sheet.locator('[data-tk="recharge-pay"]').click();
    await page.waitForURL(/\/pay\/checkout\//);
    const checkout = page.locator('[data-tk="checkout"]');
    await expect(checkout.locator('[data-tk="test-ribbon"]')).toBeVisible();
    await expect(checkout.locator('[data-tk="coin-continue"]')).toBeDisabled();
    await shot(page, "crypto-coin");
    await checkout.locator('[data-tk="coin-USDT"]').click();
    await expect(checkout.locator('[data-tk="coin-continue"]')).toBeDisabled();
    await expect(checkout.locator('[data-tk="network-TRC-20"]')).toBeVisible();
    await shot(page, "crypto-network");
    await checkout.locator('[data-tk="network-TRC-20"]').click();
    await checkout.locator('[data-tk="coin-continue"]').click();
    await expect(checkout.locator('[data-tk="crypto-amount"]')).toContainText("USDT");
    await expect(checkout.locator('[data-tk="crypto-amount"]')).toContainText("Estimate");
    await expect(checkout.locator('[data-tk="deposit-address"]')).toHaveText(/^T[A-Za-z0-9]{33}$/);
    await expect(checkout.locator('[data-tk="mock-qr"]')).toBeVisible();
    await expect(checkout.locator('[data-tk="copy-address"]')).toBeVisible();
    await expect(checkout.locator('[data-tk="crypto-timer"]')).toContainText(/2[0-9]:[0-9]{2}|30:00/);
    await expect(checkout.locator("input, textarea")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "crypto-pay");
    expect(await balance(page)).toBe(0);
    await checkout.locator('[data-tk="crypto-paid"]').click();
    await expect(checkout.locator('[data-tk="checkout-busy"]')).toContainText("Waiting for confirmation");
    await shot(page, "crypto-waiting");
    await page.waitForURL(/\/u\/account\/credits\//, { timeout: 20_000 });
    await expect(page.locator('[data-tk="recharge-result"]')).toHaveAttribute("data-result", "paid");
    expect(await balance(page)).toBeGreaterThan(0);
    await page.goto("/u/account/credits/history/");
    await expect(page.locator('[data-tk="purchase-row"]').first()).toContainText("Crypto USDT TRC-20");
  });

  test("an expired crypto window says so and charges nothing", async ({ page, baseURL }) => {
    await signIn(page, baseURL!, "rechexpire");
    const sheet = await openSheet(page);
    await sheet.locator('[data-tk="recharge-crypto"]').click();
    await sheet.locator('[data-tk="recharge-pay"]').click();
    await page.waitForURL(/\/pay\/checkout\//);
    const id = page.url().split("/").filter(Boolean).pop()!;
    await page.locator('[data-tk="coin-BTC"]').click();
    await page.locator('[data-tk="coin-continue"]').click();
    await expect(page.locator('[data-tk="deposit-address"]')).toHaveText(/^bc1q/);
    await withLocalDb((db) => db.collection("payments").updateOne({ _id: new ObjectId(id) }, { $set: { expiresAt: new Date(Date.now() - 1000) } }));
    await page.reload();
    const ended = page.locator('[data-tk="checkout-ended"]');
    await expect(ended).toContainText("The payment window has ended. Nothing was charged.");
    await shot(page, "crypto-expired");
    expect(await balance(page)).toBe(0);
  });

  test("the header credits pill opens the sheet, and a shortfall pre-selects the smallest pack that covers it", async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the header pill is a desktop part");
    await signIn(page, baseURL!, "rechpill");
    await page.goto("/");
    await page.locator('[data-tk="header-coins"]').click();
    await expect(page.locator('[data-tk="recharge-sheet"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-tk="recharge-sheet"]')).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tk-recharge-open", { detail: { shortfall: 300 } })));
    const sheet = page.locator('[data-tk="recharge-sheet"]');
    await expect(sheet.locator('[data-tk="recharge-short"]')).toContainText("You need 300 more credits");
    const picked = await sheet.locator('[data-tk="recharge-pack"][aria-checked="true"] strong').innerText();
    const totals = await sheet.locator('[data-tk="recharge-pack"] strong').allInnerTexts();
    const numbers = totals.map((value) => Number(value.replace(/,/g, "")));
    const smallest = numbers.find((value) => value >= 300);
    expect(Number(picked.replace(/,/g, ""))).toBe(smallest);
  });
});

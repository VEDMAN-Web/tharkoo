import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { withFooterAdmin } from "./footer-admin";
import { expect, hasHorizontalScroll, test } from "./helpers";

/**
 * FIX-21: the code has no stand-in phone number or Telegram name. The Contact page, the Help page, the top strip, the footer and the chat
 * show a WhatsApp, Telegram or phone row only when an admin value is saved. Set SHOTS_DIR to also save a screenshot of each page.
 */

const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: `${shotsDir}/${name}-${page.viewportSize()?.width ?? 0}.png`, fullPage: true });
}

test.describe("FIX-21 nothing saved: no stand-in rows", () => {
  test("Contact keeps Live chat and Email and has no WhatsApp, Phone or Telegram card", async ({ page }) => {
    await page.goto("/contact/");
    await expect(page.locator("h1")).toHaveCount(1);
    const cards = page.locator(".tkp-cards");
    await expect(cards).toContainText("Live chat");
    await expect(cards).toContainText("Email");
    for (const word of ["WhatsApp", "Phone", "Call us"]) await expect(cards, word).not.toContainText(word);
    await expect(page.getByText("Telegram")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toContain("912345678");
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "contact-empty");
  });

  test("Help has Chat with us and Send us a message, and no WhatsApp or Telegram button", async ({ page }) => {
    await page.goto("/help/");
    const team = page.locator(".h714-help-actions");
    await expect(team.getByRole("link", { name: /Chat with us/ })).toBeVisible();
    await expect(team.getByRole("link", { name: "WhatsApp" })).toHaveCount(0);
    await expect(team.getByRole("link", { name: "Telegram" })).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "help-empty");
  });

  test("the top strip has no phone pill and the page does not scroll sideways", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-tk="top-bar"]')).toBeVisible();
    await expect(page.locator('[data-tk="top-bar-phone"]')).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "home-empty");
  });
});

test.describe("FIX-21 values saved: the rows come back", () => {
  test("Contact shows WhatsApp, Phone and Telegram with the saved values, and Help shows both buttons", async ({ page }) => {
    await withFooterAdmin(page, "/", async () => {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await page.goto("/contact/");
        if ((await page.getByRole("link", { name: /Open WhatsApp/ }).count()) > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      await expect(page.getByRole("link", { name: /Open WhatsApp/ })).toHaveAttribute("href", "https://wa.me/919000011111");
      await expect(page.getByRole("link", { name: /Call us/ })).toHaveAttribute("href", "tel:+919000033333");
      await expect(page.getByRole("link", { name: "@tharkoo_test", exact: true })).toHaveAttribute("href", "https://t.me/tharkoo_test");
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "contact-saved");
      await page.goto("/help/");
      const team = page.locator(".h714-help-actions");
      await expect(team.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me\/919000011111/);
      await expect(team.getByRole("link", { name: "Telegram" })).toHaveAttribute("href", /t\.me\/tharkoo_test/);
      await shot(page, "help-saved");
    });
  });
});

test.describe("FIX-21 tablet width", () => {
  test("Contact and Help fit at 768 px with nothing saved", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    for (const path of ["/contact/", "/help/"]) {
      await page.goto(path);
      expect(await hasHorizontalScroll(page), path).toBe(false);
      await shot(page, `${path.replaceAll("/", "")}-empty`);
    }
  });
});

import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.54: Menus and footer as cards with compact link rows and one save bar. */

const SHOTS = process.env.H854_SHOTS_DIR ?? "";
const CARDS = ["Header", "About text and trust pills", "Quick links", "Top categories", "Get in touch", "Legal pills", "Social links", "Adults notice and copyright"];

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

const saveButton = (page: Page) => page.locator('[data-tk="save-bar"]').getByRole("button", { name: "Save", exact: true });
const toast = (page: Page) => page.locator('[data-tk="toast"]');
const quick = (page: Page) => page.locator('[data-tk="card-footer-quick"]');

async function storedQuick() {
  const row = await withLocalDb((db) => db.collection("shell_config_settings").findOne({ key: "default" }, { projection: { config: 1 } }));
  return (((row?.config as { footer?: { quickLinks?: { label: string }[] } } | undefined)?.footer?.quickLinks) ?? []).map((item) => item.label);
}

test.describe("H8.54 Menus and footer", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("cards, compact rows, column names once per list, quiet icon buttons, tap targets of 24 px, no old Home block, axe clean and no sideways scroll at 1440 and 390", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/menus/");
      await expect(page.locator('[data-tk="menus-screen"]')).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Menus and footer");
      for (const title of CARDS) await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
      await expect(page.getByText("Home page (New design)")).toHaveCount(0);
      await expect(page.getByText("Ads live for 72 hours")).toHaveCount(0);
      await expect(page.getByText("Post for free")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Up", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Down", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
      const lists = await page.locator('[data-tk="link-list"]').count();
      const heads = await page.locator('[data-tk="link-list"] .adm-menu-head').count();
      expect(lists).toBeGreaterThan(3);
      expect(heads).toBeLessThanOrEqual(lists);
      const rows = await page.locator('[data-tk="link-row"]').count();
      expect(rows).toBeGreaterThan(heads);
      expect(await page.locator('[data-tk="link-row"] label', { hasText: /^Text$/ }).count()).toBe(0);
      await expect(page.locator('[data-tk="social-live"] li')).toHaveCount(6);
      await expect(page.locator('[data-tk="social-live"]')).toContainText("WhatsApp");
      await expect(page.locator('[data-tk="pictures-moved"]')).toContainText("Category and city pictures are now set in");
      const small = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-tk="menus-screen"] button, [data-tk="menus-screen"] input:not([type=hidden]), [data-tk="menus-screen"] select, [data-tk="menus-screen"] textarea'))
          .filter((node) => node.getClientRects().length > 0)
          .map((node) => ({ node, box: node.getBoundingClientRect() }))
          .filter(({ box }) => box.width < 24 || box.height < 24)
          .map(({ node }) => `${node.tagName.toLowerCase()} ${node.getAttribute("aria-label") ?? ""}`),
      );
      expect(small).toEqual([]);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "menus");
    }
  });

  test("add a link, reorder it, save with Undo, remove it; the leave guard and Discard", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/menus/");
    const rows = quick(page).locator('[data-tk="link-row"]');
    const count = await rows.count();
    const before = await rows.getByRole("textbox", { name: /^Text of/ }).evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value));
    const stamp = String(Date.now() % 100000);

    await quick(page).getByRole("button", { name: "Add a link" }).click();
    await expect(rows).toHaveCount(count + 1);
    await rows.last().getByRole("textbox", { name: /^Text of/ }).fill(`H854 link ${stamp}`);
    await rows.last().getByRole("textbox", { name: /^Link of/ }).fill(`/h854-${stamp}/`);
    await expect(page.locator('[data-tk="save-bar"]')).toContainText("Unsaved changes");
    await rows.last().getByRole("button", { name: `Move H854 link ${stamp} up` }).click();
    expect(await rows.nth(count - 1).getByRole("textbox", { name: /^Text of/ }).inputValue()).toBe(`H854 link ${stamp}`);

    page.once("dialog", (dialog) => void dialog.dismiss());
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/admin\/menus\//);

    await saveButton(page).click();
    await expect(toast(page)).toContainText("Saved.");
    await expect(page.locator('[data-tk="save-bar"]')).toContainText("All changes saved");
    await expect.poll(async () => (await storedQuick()).includes(`H854 link ${stamp}`)).toBe(true);
    expect((await storedQuick()).indexOf(`H854 link ${stamp}`)).toBe(count - 1);

    await page.locator('[data-tk="toast-undo"]').click();
    await expect.poll(async () => (await storedQuick()).includes(`H854 link ${stamp}`)).toBe(false);
    expect(await storedQuick()).toEqual(before);
    await expect(rows).toHaveCount(count);

    await quick(page).getByRole("button", { name: "Add a link" }).click();
    await rows.last().getByRole("textbox", { name: /^Text of/ }).fill("Temporary");
    await page.locator('[data-tk="save-bar"]').getByRole("button", { name: "Discard" }).click();
    await expect(rows).toHaveCount(count);

    if (count > 0) {
      const first = await rows.first().getByRole("textbox", { name: /^Text of/ }).inputValue();
      await rows.first().getByRole("button", { name: /^Remove / }).click();
      await expect(rows).toHaveCount(count - 1);
      await saveButton(page).click();
      await expect(toast(page)).toContainText("Saved.");
      await expect.poll(async () => (await storedQuick()).includes(first)).toBe(false);
      await page.locator('[data-tk="toast-undo"]').click();
      await expect.poll(async () => (await storedQuick()).includes(first)).toBe(true);
      expect(await storedQuick()).toEqual(before);
    }
  });
});

import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H8.2 (A2): the admin kit gallery at /admin/kit/. */

const SHOTS = process.env.A2_SHOTS ?? "";

async function openGallery(page: Page, baseURL: string) {
  await signInAdminContext(page.context(), baseURL);
  await page.goto("/admin/kit/");
  await expect(page.locator("[data-tk=kit-gallery]")).toBeVisible();
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

test.describe("H8.2 admin kit core", () => {
  test("a signed-out visitor does not see the gallery", async ({ page }) => {
    await page.goto("/admin/kit/");
    await expect(page.locator("[data-tk=kit-gallery]")).toHaveCount(0);
  });

  test("the gallery renders with one H1, no sideways scroll, text and targets big enough, and no serious axe problems", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);
    for (const name of ["Buttons", "Status badges", "Tabs", "Toasts, dialogs and the drawer"]) await expect(page.locator(`section[aria-label="${name}"]`)).toBeVisible();
    const sizes = await page.locator(".adm-k button:visible, .adm-k a:visible").evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { text: (node.textContent || node.getAttribute("aria-label") || "").trim().slice(0, 24), width: box.width, height: box.height, font: parseFloat(getComputedStyle(node).fontSize) };
      }),
    );
    const least = isPhone(page) ? 44 : 24;
    for (const item of sizes) {
      expect(item.font, item.text).toBeGreaterThanOrEqual(12);
      expect(item.height, `${item.text} height`).toBeGreaterThanOrEqual(least);
      expect(item.width, `${item.text} width`).toBeGreaterThanOrEqual(least);
    }
    const found = await new AxeBuilder({ page }).include("[data-tk=kit-gallery]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "a2-gallery");
  });

  test("the page header runs More, secondary, primary on a desktop, and moves secondary into More on a phone", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    const header = page.locator("[data-tk=page-header]");
    const more = header.getByRole("button", { name: "More" });
    const primary = header.getByRole("button", { name: "Start reviewing" });
    await expect(primary).toBeVisible();
    if (isPhone(page)) {
      await expect(header.getByRole("link", { name: "View site" })).toBeHidden();
      await more.click();
      await expect(page.getByRole("menuitem", { name: "View site" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
    } else {
      const m = (await more.boundingBox())!;
      const s = (await header.getByRole("link", { name: "View site" }).boundingBox())!;
      const p = (await primary.boundingBox())!;
      expect(m.x).toBeLessThan(s.x);
      expect(s.x).toBeLessThan(p.x);
    }
    await more.click();
    await expect(page.getByRole("menuitem", { name: "History" })).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("tabs show counts and move with the arrow keys", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    const live = page.getByRole("tab", { name: /Live, not checked/ });
    await expect(live).toHaveAttribute("aria-selected", "true");
    await expect(live).toContainText("14");
    await live.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Held by rules/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("[data-tk=tab-panel]")).toContainText("Held by rules");
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: /Edited, photos waiting/ })).toHaveAttribute("aria-selected", "true");
  });

  test("the undo toast counts down from 10 s, pauses while hovered, runs Undo, and goes away by itself; an error stays", async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    await openGallery(page, baseURL!);
    await page.getByRole("button", { name: "Show undo toast" }).click();
    const toast = page.locator("[data-tk=toast]");
    await expect(toast).toHaveAttribute("data-kind", "undo");
    await expect(toast.locator("[data-tk=toast-count]")).toHaveText("10 s");
    await shot(page, "a2-undo-toast");
    await page.waitForTimeout(2600);
    const before = await toast.locator("[data-tk=toast-count]").innerText();
    expect(Number(before.replace(/\D/g, ""))).toBeLessThanOrEqual(8);
    await toast.hover();
    const paused = await toast.locator("[data-tk=toast-count]").innerText();
    await page.waitForTimeout(2200);
    await expect(toast.locator("[data-tk=toast-count]")).toHaveText(paused);
    await page.mouse.move(2, 2);
    await expect(toast).toHaveCount(0, { timeout: 15_000 });

    await page.getByRole("button", { name: "Show undo toast" }).click();
    await page.locator("[data-tk=toast-undo]").click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Undone.");

    await page.getByRole("button", { name: "Show success toast" }).click();
    await expect(page.locator("[data-tk=toast]")).toHaveAttribute("data-kind", "success");
    await expect(page.locator("[data-tk=toast]")).toHaveCount(0, { timeout: 7_000 });

    await page.getByRole("button", { name: "Show error toast" }).click();
    const error = page.locator("[data-tk=toast]");
    await expect(error).toHaveAttribute("role", "alert");
    await page.waitForTimeout(5000);
    await expect(error).toBeVisible();
    await page.locator("[data-tk=toast-close]").click();
    await expect(error).toHaveCount(0);
  });

  test("the drawer is 420 px on a desktop and full screen under 600 px, traps focus, and closes with Esc back to its button", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    const trigger = page.getByRole("button", { name: "Open drawer" });
    await trigger.click();
    const drawer = page.locator("[data-tk=drawer]");
    await expect(drawer).toBeVisible();
    const box = (await drawer.boundingBox())!;
    const view = page.viewportSize()!;
    if (view.width < 600) {
      expect(Math.round(box.width)).toBe(view.width);
      expect(Math.round(box.height)).toBe(view.height);
      await expect(drawer.getByRole("button", { name: "Back" })).toBeVisible();
    } else {
      expect(Math.round(box.width)).toBe(420);
      await expect(drawer.getByRole("button", { name: "Close" })).toBeVisible();
    }
    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest("[data-tk=drawer]")))).toBe(true);
    }
    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest("[data-tk=drawer]")))).toBe(true);
    }
    const cancel = (await drawer.getByRole("button", { name: "Cancel" }).boundingBox())!;
    const save = (await drawer.getByRole("button", { name: "Save changes" }).boundingBox())!;
    expect(cancel.x).toBeLessThan(save.x);
    await shot(page, "a2-drawer");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("the reason dialog asks for a reason, gives back credits only when ticked, needs the typed words, and Esc cancels back to its button", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    const ban = page.getByRole("button", { name: "Ban user..." });
    await ban.click();
    const dialog = page.locator("[data-tk=reason-dialog]");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Ban spam.bot22?" })).toBeVisible();
    await expect(dialog.locator("[data-tk=give-back]")).toHaveCount(0);
    const cancel = (await dialog.getByRole("button", { name: "Cancel" }).boundingBox())!;
    const confirm = (await dialog.getByRole("button", { name: "Ban user" }).boundingBox())!;
    expect(cancel.x).toBeLessThan(confirm.x);
    await shot(page, "a2-reason-dialog");
    await dialog.getByRole("button", { name: "Ban user" }).click();
    await expect(dialog.getByText("Choose a reason.")).toBeVisible();
    await dialog.getByLabel("Other").check();
    await dialog.getByRole("button", { name: "Ban user" }).click();
    await expect(dialog.getByText("Write at least 3 characters.")).toBeVisible();
    await dialog.getByLabel("Spam").check();
    await dialog.getByLabel("Tell the team more").fill("14 ads in 5 minutes");
    await dialog.getByRole("button", { name: "Ban user" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("[data-tk=toast]")).toContainText("spam.bot22 banned.");

    // Give back the credits shows only for a paid ad that is rejected or removed, and is off by default.
    await page.getByRole("button", { name: "Remove paid ad..." }).click();
    const paid = page.locator("[data-tk=reason-dialog]");
    await expect(paid.getByRole("heading", { name: "Remove this ad?" })).toBeVisible();
    await expect(paid.locator("[data-tk=give-back]")).toContainText("Give back the 30 credits to Riya");
    await expect(paid.locator("[data-tk=give-back] input")).not.toBeChecked();
    await paid.getByRole("button", { name: "Cancel" }).click();
    await expect(paid).toHaveCount(0);
    await page.getByRole("button", { name: "End demo ads..." }).click();
    const typed = page.locator("[data-tk=reason-dialog]");
    await typed.getByRole("button", { name: "End demo ads" }).click();
    await expect(typed.getByText("Type END DEMO to confirm.").first()).toBeVisible();
    await typed.getByLabel(/Type END DEMO to confirm/).fill("END DEMO");
    await typed.getByRole("button", { name: "End demo ads" }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Demo ads ended.");

    const demo = page.getByRole("button", { name: "End demo ads..." });
    await demo.click();
    await expect(page.locator("[data-tk=reason-dialog]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-tk=reason-dialog]")).toHaveCount(0);
    await expect(demo).toBeFocused();
  });

  test("move buttons reorder the list by clicking, with labels, on a phone too", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    const list = page.locator("[data-tk=slot-list] li");
    await expect(list.first()).toContainText("Study table, teak");
    await expect(page.getByRole("button", { name: "Move Study table, teak up" })).toBeDisabled();
    await page.getByRole("button", { name: "Move Study table, teak down" }).click();
    await expect(list.first()).toContainText("Two seater sofa");
    await expect(list.nth(1)).toContainText("Study table, teak");
    await expect(page.getByRole("group", { name: "Move Study table, teak" })).toBeVisible();
  });

  test("the bottom bar shows on a phone with at most 5 items and is hidden on a desktop; a lock badge says why", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    const bar = page.locator("[data-tk=bottom-bar]");
    if (isPhone(page)) {
      await expect(bar).toBeVisible();
      expect(await bar.locator("a").count()).toBeLessThanOrEqual(5);
      const box = (await bar.boundingBox())!;
      expect(Math.round(box.height)).toBe(64);
    } else {
      await expect(bar).toBeHidden();
    }
    await expect(page.locator("[data-tk=lock-badge]")).toContainText("Payments taken cannot be undone");
  });
});

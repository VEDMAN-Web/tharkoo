import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H8.4 (A4): tables, filters, history, picture field and record form in the gallery at /admin/kit/. */

const SHOTS = process.env.A4_SHOTS ?? "";
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

async function openGallery(page: Page, baseURL: string) {
  await signInAdminContext(page.context(), baseURL);
  await page.goto("/admin/kit/");
  await expect(page.locator("[data-tk=kit-gallery]")).toBeVisible();
}

async function shot(page: Page, name: string, selector?: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  const path = `${SHOTS}/${name}-${size?.width}x${size?.height}.png`;
  if (selector) await page.locator(selector).first().screenshot({ path });
  else await page.screenshot({ path });
}

const table = (page: Page) => page.locator("[data-tk=server-table]");

test.describe("H8.4 admin kit tables and history", () => {
  test("the table pages with Previous and Next and page sizes 25, 50, 100, and says which rows are shown", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    await table(page).scrollIntoViewIfNeeded();
    await expect(table(page).locator("tbody tr")).toHaveCount(25);
    await expect(table(page).locator("[data-tk=pager-range]")).toHaveText("1 to 25 of 64");
    await expect(table(page).getByRole("button", { name: "Previous" })).toBeDisabled();
    await table(page).getByRole("button", { name: "Next" }).click();
    await expect(table(page).locator("[data-tk=pager-range]")).toHaveText("26 to 50 of 64");
    await table(page).getByLabel("Rows per page").selectOption("100");
    await expect(table(page).locator("[data-tk=pager-range]")).toHaveText("1 to 64 of 64");
    await expect(table(page).getByRole("button", { name: "Next" })).toBeDisabled();
    expect(await table(page).locator("select option").allInnerTexts()).toEqual(["25 per page", "50 per page", "100 per page"]);
  });

  test("select all shows the bulk bar in place of the header, with the destructive action rightmost, and Clear takes it away", async ({ page, baseURL }) => {
    test.skip(isPhone(page), "the checkbox column is hidden on a phone");
    await openGallery(page, baseURL!);
    await table(page).scrollIntoViewIfNeeded();
    await expect(table(page).locator("thead")).toBeVisible();
    await table(page).getByLabel("Select all rows on this page").click();
    const bar = table(page).locator("[data-tk=bulk-bar]");
    await expect(bar).toBeVisible();
    await expect(bar.locator("[data-tk=bulk-count]")).toHaveText("25 selected");
    await expect(table(page).locator("thead")).toBeHidden();
    const approve = (await bar.getByRole("button", { name: "Approve" }).boundingBox())!;
    const reject = (await bar.getByRole("button", { name: "Reject..." }).boundingBox())!;
    expect(approve.x).toBeLessThan(reject.x);
    await shot(page, "a4-bulk-bar", "[data-tk=server-table]");
    await table(page).getByRole("button", { name: "Next" }).click();
    await expect(bar.locator("[data-tk=bulk-count]")).toHaveText("25 selected");
    await bar.getByRole("button", { name: "Clear" }).click();
    await expect(bar).toHaveCount(0);
    await expect(table(page).locator("thead")).toBeVisible();
    await table(page).getByRole("button", { name: "Previous" }).click();
    await table(page).getByLabel("Select Yoga class, mornings", { exact: true }).check();
    await expect(table(page).locator("[data-tk=bulk-count]")).toHaveText("1 selected");
  });

  test("a click on the main thing opens the row in the drawer and marks the row", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    await table(page).scrollIntoViewIfNeeded();
    const first = table(page).locator("tbody tr").first();
    await first.locator(".adm-k-rowlink").click();
    await expect(first).toHaveAttribute("data-open", "yes");
    await expect(page.locator("[data-tk=drawer]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-tk=drawer]")).toHaveCount(0);
  });

  test("a phone shows rows as cards: no header, no checkbox column, the seller column hidden, buttons full width", async ({ page, baseURL }) => {
    test.skip(!isPhone(page), "phone only");
    await openGallery(page, baseURL!);
    await table(page).scrollIntoViewIfNeeded();
    await expect(table(page).locator("thead")).toBeHidden();
    await expect(table(page).locator("tbody tr").first().locator(".adm-k-cbx")).toBeHidden();
    await expect(table(page).locator("tbody tr").first().locator("td", { hasText: "Priya S." })).toBeHidden();
    const row = table(page).locator("tbody tr").first();
    expect(await row.evaluate((node) => getComputedStyle(node).display)).toBe("block");
    const buttons = row.locator(".adm-k-rowact .adm-k-btn");
    expect(await buttons.count()).toBe(2);
    for (let index = 0; index < 2; index += 1) expect((await buttons.nth(index).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "a4-table-cards", "[data-tk=server-table]");
  });

  test("filters: a chip has an X, Add filter lists the rest, and search narrows the rows and shows an empty state", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    const bar = page.locator("[data-tk=filter-bar]");
    await bar.scrollIntoViewIfNeeded();
    await expect(bar.locator("[data-tk=filter-chip]")).toHaveCount(1);
    await expect(bar.locator("[data-tk=filter-chip]")).toContainText("Waiting over 1 h");
    await bar.getByRole("button", { name: "Add filter" }).click();
    await expect(page.getByRole("menuitem", { name: "Paid only" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Paid only" }).click();
    await expect(bar.locator("[data-tk=filter-chip]")).toHaveCount(2);
    await bar.getByRole("button", { name: "Remove filter Waiting over 1 h" }).click();
    await expect(bar.locator("[data-tk=filter-chip]")).toHaveCount(1);
    await bar.getByRole("searchbox", { name: "Search ads" }).fill("yoga");
    await expect(table(page).locator("[data-tk=pager-range]")).toHaveText("1 to 8 of 8");
    await bar.getByRole("searchbox", { name: "Search ads" }).fill("zzzz");
    await expect(table(page).locator("[data-tk=table-empty]")).toContainText("No ads waiting.");
    await shot(page, "a4-filter-bar", "[data-tk=filter-bar]");
  });

  test("the history drawer has tabs with counts, marks the current version, shows the field changes and restores as a new version", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    await page.getByRole("button", { name: "Open history" }).click();
    const history = page.locator("[data-tk=history]");
    await expect(history).toBeVisible();
    await expect(page.getByRole("tab", { name: /Versions/ })).toContainText("3");
    await expect(page.getByRole("tab", { name: /Decisions/ })).toContainText("1");
    await expect(history.getByRole("button", { name: /v5/ })).toBeDisabled();
    await history.getByRole("button", { name: /v4/ }).click();
    const diff = page.locator("[data-tk=history-diff]");
    await expect(diff).toContainText("Going back to v4 changes");
    await expect(diff.locator("del")).toContainText("9500");
    await expect(diff.locator("ins")).toContainText("950");
    const cancel = (await page.locator("[data-tk=drawer]").getByRole("button", { name: "Cancel" }).boundingBox())!;
    const restore = (await page.locator("[data-tk=drawer]").getByRole("button", { name: "Restore v4" }).boundingBox())!;
    expect(cancel.x).toBeLessThan(restore.x);
    await shot(page, "a4-history-drawer");
    await page.getByRole("tab", { name: /Money/ }).click();
    await expect(history).toContainText("Payments taken cannot be undone");
    await expect(history.getByRole("button", { name: /m1/ })).toBeDisabled();
    await page.getByRole("tab", { name: /Versions/ }).click();
    await history.getByRole("button", { name: /v4/ }).click();
    await page.locator("[data-tk=drawer]").getByRole("button", { name: "Restore v4" }).click();
    await expect(page.locator("[data-tk=drawer]")).toHaveCount(0);
    await expect(page.locator("[data-tk=toast]")).toContainText("Restored v4 as a new version.");
  });

  test("the picture field refuses to save without a picture description and puts focus on it", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    const box = page.locator("[data-tk=media-picker]");
    await box.scrollIntoViewIfNeeded();
    await expect(box.locator("[data-tk=alt-count]")).toHaveText("0 / 125");
    await page.getByRole("button", { name: "Save picture" }).click();
    await expect(box.getByText("Describe the picture in a few words (alt text).")).toBeVisible();
    await expect(box.getByLabel(/Picture description/)).toBeFocused();
    await expect(page.locator("[data-tk=toast]")).toHaveCount(0);
    await box.getByLabel(/Picture description/).fill("A pink sky over the city");
    await expect(box.locator("[data-tk=alt-count]")).toHaveText("24 / 125");
    await page.getByRole("button", { name: "Save picture" }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Picture saved.");
    await shot(page, "a4-media-picker", "[data-tk=media-picker]");
  });

  test("the record form shows an error summary with links, validates on blur, counts unsaved changes and saves with Ctrl S", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    const form = page.locator("[data-tk=record-form]");
    await form.scrollIntoViewIfNeeded();
    const title = form.getByLabel(/^Title/);
    await expect(form.locator("[data-tk=save-bar]")).toHaveAttribute("data-dirty", "no");
    await title.fill("abc");
    await expect(form.locator("[data-tk=save-bar]")).toContainText("1 unsaved change");
    await expect(form.locator("[data-tk=save-bar]")).toContainText("Title");
    await title.blur();
    await expect(form.getByText("Write at least 5 characters.")).toBeVisible();
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await form.getByRole("button", { name: "Save changes" }).click();
    const summary = form.locator("[data-tk=form-summary]");
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await summary.getByRole("link", { name: /Title: Write at least 5 characters/ }).click();
    await expect(title).toBeFocused();
    await shot(page, "a4-record-form", "[data-tk=record-form]");
    await title.fill("A proper flat title");
    await expect(summary).toHaveCount(0);
    await page.keyboard.press("Control+s");
    await expect(page.locator("[data-tk=toast]")).toContainText("Changes saved.");
    await expect(form.locator("[data-tk=save-bar]")).toHaveAttribute("data-dirty", "no");
    await title.fill("Another title");
    await form.getByRole("button", { name: "Discard" }).click();
    await expect(title).toHaveValue("A proper flat title");
  });

  test("the whole gallery has no sideways scroll, text under 12 px, small targets or serious axe problems", async ({ page, baseURL }) => {
    await openGallery(page, baseURL!);
    expect(await hasHorizontalScroll(page)).toBe(false);
    const least = isPhone(page) ? 44 : 24;
    const sizes = await page.locator(".adm-k button:visible, .adm-k a:visible, .adm-k input[type=checkbox]:visible, .adm-k select:visible").evaluateAll((nodes) =>
      nodes.map((node) => {
        const label = node instanceof HTMLInputElement ? node.closest("label") : null;
        const box = (label ?? node).getBoundingClientRect();
        return { text: (node.textContent || node.getAttribute("aria-label") || node.tagName).trim().slice(0, 28), width: box.width, height: box.height };
      }),
    );
    for (const item of sizes) {
      expect(item.height, `${item.text} height`).toBeGreaterThanOrEqual(least);
      expect(item.width, `${item.text} width`).toBeGreaterThanOrEqual(Math.min(least, 24));
    }
    const small = await page.locator(".adm-k *").evaluateAll((nodes) =>
      nodes
        .filter((node) => Array.from(node.childNodes).some((child) => child.nodeType === 3 && (child.textContent || "").trim()) && node.getBoundingClientRect().width > 0)
        .map((node) => ({ text: (node.textContent || "").trim().slice(0, 24), font: parseFloat(getComputedStyle(node).fontSize) }))
        .filter((item) => item.font < 12),
    );
    expect(small).toEqual([]);
    const found = await new AxeBuilder({ page }).include("[data-tk=kit-gallery]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "a4-gallery");
  });
});

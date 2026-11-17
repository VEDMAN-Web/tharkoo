import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.36 (A36): the four generic record screens. */

const SHOTS = process.env.A36_SHOTS ?? "";
const SCREENS = [
  { path: "/admin/banned-words/", title: "Banned words" },
  { path: "/admin/broadcasts/", title: "Broadcasts" },
  { path: "/admin/flags/", title: "Feature flags" },
  { path: "/admin/help-sections/", title: "Help sections" },
];

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

const rowsOf = (page: Page) => page.locator('[data-tk="records-screen"] tbody tr');

test.describe("A36 generic record screens", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("add a word, check the form, change it, undo, and delete it", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    const word = `a36-word-${Date.now().toString(36)}`;
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/banned-words/");
    await expect(page.locator("h1")).toHaveText("Banned words");
    await shot(page, "banned-words-list");

    await page.getByRole("button", { name: "New word" }).click();
    const drawer = page.locator('[data-tk="record-drawer"]');
    await expect(drawer).toBeVisible();
    await page.getByRole("button", { name: "Add word" }).click();
    await expect(page.locator('[data-tk="form-summary"]')).toContainText("Enter the word or phrase");
    await shot(page, "banned-words-error");
    await drawer.getByLabel(/Word or phrase/).fill(word);
    await shot(page, "banned-words-drawer");
    await page.getByRole("button", { name: "Add word" }).click();
    await expect(page.getByText(`Created ${word}.`)).toBeVisible();
    await expect(drawer).toBeHidden();

    await page.getByRole("searchbox", { name: "Search words" }).fill(word);
    await expect(page).toHaveURL(/q=/);
    await expect(rowsOf(page)).toHaveCount(1);
    await expect(rowsOf(page).first()).toContainText("Stop it from posting");
    await rowsOf(page).first().getByRole("button", { name: "Edit" }).click();
    await expect(drawer).toBeVisible();
    await expect(page.getByText("Raw data (superadmin only)")).toBeVisible();
    await drawer.getByLabel("What happens").selectOption("review");
    await page.getByRole("button", { name: "Save word" }).click();
    await expect(page.getByText(`Saved ${word}.`)).toBeVisible();
    await expect(rowsOf(page).first()).toContainText("Send it to review");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Undone. The old values are back.")).toBeVisible();
    await expect(rowsOf(page).first()).toContainText("Stop it from posting");

    await rowsOf(page).first().getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Delete word..." }).click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toContainText("Delete this word?");
    await shot(page, "banned-words-delete");
    await dialog.getByRole("button", { name: "Delete word" }).click();
    await expect(page.getByText(`Deleted ${word}.`)).toBeVisible();
    await expect(page.locator('[data-tk="records-empty"]')).toBeVisible();
    const left = await withLocalDb((db) => db.collection("banned_words").countDocuments({ text: word }));
    expect(left === null || left === 0).toBe(true);
  });

  test("a notice and a flag: validation text, switch, raw data, and the key stays fixed", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    const stamp = Date.now().toString(36);
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/broadcasts/");
    await page.getByRole("button", { name: "New notice" }).click();
    await page.getByLabel(/^Title/).fill(`A36 notice ${stamp}`);
    await page.getByLabel(/^Where it shows/).fill("top-bar");
    await page.getByLabel(/^Link/).fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Add notice" }).click();
    await expect(page.locator('[data-tk="form-summary"]')).toContainText("Start with /");
    await page.getByLabel(/^Link/).fill("/prices/");
    await page.getByRole("button", { name: "Add notice" }).click();
    await expect(page.getByText(`Created A36 notice ${stamp}.`)).toBeVisible();
    await page.getByRole("searchbox", { name: "Search notices" }).fill(`A36 notice ${stamp}`);
    await expect(page).toHaveURL(/q=/);
    await expect(rowsOf(page)).toHaveCount(1);
    await expect(rowsOf(page).first()).toContainText("On");
    await rowsOf(page).first().getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Show this notice").uncheck();
    await page.locator("details[data-tk=raw-data] summary").click();
    await expect(page.getByLabel("Raw data as JSON")).toHaveValue(new RegExp(`"title": "A36 notice ${stamp}"`));
    await page.getByRole("button", { name: "Save notice" }).click();
    await expect(page.getByText(`Saved A36 notice ${stamp}.`)).toBeVisible();
    await expect(rowsOf(page).first()).toContainText("Off");
    await rowsOf(page).first().getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Delete notice..." }).click();
    await page.locator('[data-tk="reason-dialog"]').getByRole("button", { name: "Delete notice" }).click();
    await expect(page.getByText(`Deleted A36 notice ${stamp}.`)).toBeVisible();

    await page.goto("/admin/flags/");
    await page.getByRole("button", { name: "New flag" }).click();
    await page.getByLabel(/^Name/).fill(`A36 flag ${stamp}`);
    await page.getByLabel(/^Key/).fill("Bad Key");
    await page.getByRole("button", { name: "Add flag" }).click();
    await expect(page.locator('[data-tk="form-summary"]')).toContainText("lowercase");
    await page.getByLabel(/^Key/).fill(`a36.flag.${stamp}`);
    await page.getByRole("button", { name: "Add flag" }).click();
    await expect(page.getByText(`Created A36 flag ${stamp}.`)).toBeVisible();
    await page.getByRole("searchbox", { name: "Search flags" }).fill(`a36.flag.${stamp}`);
    await expect(page).toHaveURL(/q=/);
    await rowsOf(page).first().getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel(/^Key/)).toBeDisabled();
    await page.getByRole("button", { name: "Delete flag..." }).click();
    await page.locator('[data-tk="reason-dialog"]').getByRole("button", { name: "Delete flag" }).click();
    await expect(page.getByText(`Deleted A36 flag ${stamp}.`)).toBeVisible();
  });

  test("all four screens fit 390, 768 and 1440 with no sideways scroll and pass axe", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      for (const screen of SCREENS) {
        await page.goto(screen.path);
        await expect(page.locator("h1")).toHaveText(screen.title);
        await expect(page.locator('[data-tk="records-screen"]')).toBeVisible();
        expect(await hasHorizontalScroll(page), `${screen.path} ${size.width}`).toBe(false);
        await shot(page, screen.path.replaceAll("/", "-").replace(/^-admin-|-$/g, ""));
        const found = await new AxeBuilder({ page }).include('[data-tk="records-screen"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`), `${screen.path} ${size.width}`).toEqual([]);
      }
    }
  });
});

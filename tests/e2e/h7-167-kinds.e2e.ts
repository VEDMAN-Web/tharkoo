import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H7.167: the Kinds manager under Categories & fields, and the locked rule for people listings. */

const SHOTS = process.env.H7167_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}

test.describe("H7.167 Kinds manager", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`add, edit and remove a kind, with Undo, at ${size.width}`, async ({ page, context, baseURL }) => {
      test.setTimeout(180_000);
      await signInAdminContext(context, baseURL!);
      await page.setViewportSize(size);
      await page.goto("/admin/categories/");
      await expect(page.locator('[data-tk="categories-screen"]')).toBeVisible();
      const open = size.width < 768 ? page.locator("#adm-content").getByRole("button", { name: "More" }) : page.locator("#adm-content").getByRole("button", { name: "Kinds" });
      await open.click();
      if (size.width < 768) await page.getByRole("menuitem", { name: "Kinds" }).click();
      const drawer = page.locator('[data-tk="drawer"]');
      await expect(drawer).toBeVisible();
      const rows = drawer.locator('[data-tk="kind-row"]');
      await expect(rows.first()).toBeVisible();
      for (const key of ["goods", "property", "vehicle", "job", "service", "people"]) await expect(drawer.locator(`[data-key="${key}"]`)).toBeVisible();
      await shot(page, "kinds-list");

      const name = `Events ${Date.now() % 100000}`;
      await drawer.getByRole("button", { name: "Add a kind" }).click();
      await drawer.getByLabel("Name").fill(name);
      await drawer.getByLabel(/^Max photos/).fill("6");
      await expect(drawer.getByRole("switch", { name: "Show the map" })).toHaveCount(0);
      await drawer.getByRole("switch", { name: "Live video tours allowed" }).click();
      await shot(page, "kinds-add");
      await drawer.getByRole("button", { name: "Add kind", exact: true }).click();
      const row = drawer.locator('[data-tk="kind-row"]', { hasText: name });
      await expect(row).toBeVisible();
      await expect(row).toContainText("No category uses it");

      await row.getByRole("button", { name: "Edit" }).click();
      await expect(row.getByRole("switch", { name: "Show the price on the ad page" })).toHaveAttribute("aria-checked", "true");
      await expect(row.getByRole("switch", { name: "Live video tours allowed" })).toHaveAttribute("aria-checked", "true");
      await row.getByRole("button", { name: "Remove" }).click();
      await expect(drawer.locator('[data-tk="kind-row"]', { hasText: name })).toHaveCount(0);
      await page.locator('[data-tk="toast-undo"]').click();
      await expect(drawer.locator('[data-tk="kind-row"]', { hasText: name })).toBeVisible();
      await row.getByRole("button", { name: "Edit" }).click();
      await row.getByRole("button", { name: "Remove" }).click();
      await expect(drawer.locator('[data-tk="kind-row"]', { hasText: name })).toHaveCount(0);
    });
  }

  test("a kind in use cannot be removed, People cannot be given video, and a people listing says so", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/categories/");
    await page.locator("#adm-content").getByRole("button", { name: "Kinds" }).click();
    const drawer = page.locator('[data-tk="drawer"]');
    const used = drawer.locator('[data-tk="kind-row"]').filter({ hasText: /\d+ categor/ }).first();
    await used.getByRole("button", { name: "Edit" }).click();
    await expect(used.getByRole("button", { name: "In use: cannot remove" })).toBeDisabled();
    await used.getByRole("button", { name: "Cancel" }).click();
    const people = drawer.locator('[data-key="people"]');
    await people.getByRole("button", { name: "Edit" }).click();
    await expect(people.getByRole("switch", { name: "Live video tours allowed" })).toBeDisabled();
    await expect(people.locator('[data-tk="video-never"]')).toHaveText("Video is never allowed on listings about people.");
    await expect(people).toContainText("cannot be removed");
    const serious = (await new AxeBuilder({ page }).include('[data-tk="kinds-manager"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(serious.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await page.keyboard.press("Escape");

    await page.goto("/admin/categories/?c=dating");
    await expect(page.locator('[data-tk="people-locked"]')).toContainText("Video is never allowed on listings about people.");
    expect(await hasHorizontalScroll(page)).toBe(false);
    await page.goto("/admin/settings/video-tours/");
    await expect(page.getByRole("switch", { name: /Live video tours for Dating/ })).toBeDisabled();
    await expect(page.getByText("Video is never allowed on listings about people.").first()).toBeVisible();
  });
});

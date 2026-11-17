import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, setRoles, signInAdminContext, test, uniqueEmail } from "./helpers";

const SHOTS = process.env.A10_SHOTS_DIR || "";

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("A10 admin dashboard", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("one H1, a To do card, an 11 row launch checklist and recent changes, with no sideways scroll and axe 0", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
    await expect(page.locator('[data-tk="shell-title"]')).toHaveText("Dashboard");
    await expect(page.locator('[data-tk="todo"]')).toBeVisible();
    await expect(page.locator('[data-tk="launch-checklist"] li')).toHaveCount(11);
    await expect(page.locator('[data-tk="launch-checklist"]')).toContainText(/\d+ of 11 done/);
    await expect(page.locator('[data-tk="recent"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "History & undo" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "View site" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/dashboard-1440x900.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/admin/");
      await page.screenshot({ path: `${SHOTS}/dashboard-390x844.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    for (const tick of await page.locator('[data-tk="launch-checklist"] button[role=checkbox]').all()) expect((await tick.boundingBox())!.width).toBeGreaterThanOrEqual(24);
  });

  test("ticking a manual row survives a reload, shows in recent changes, and can be unticked", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/");
    const row = page.locator('[data-tk="check-banner"]');
    const box = row.getByRole("checkbox");
    if ((await box.getAttribute("aria-checked")) === "true") await box.click();
    await expect(box).toHaveAttribute("aria-checked", "false");
    await box.click();
    await expect(box).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(page.locator('[data-tk="check-banner"]').getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[data-tk="recent-changes"]')).toContainText("ticked the “banner picture checked” row");
    await page.locator('[data-tk="check-banner"]').getByRole("checkbox").click();
    await expect(page.locator('[data-tk="check-banner"]').getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
    await page.reload();
    await expect(page.locator('[data-tk="check-banner"]').getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
  });

  test("a moderator sees its own To do rows and no checklist or money numbers", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const email = uniqueEmail("a10mod");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    const promoted = await setRoles(email, ["moderator"]);
    test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    await loginUi(page, email, undefined, "/admin/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('[data-tk="todo-review"]')).toBeVisible();
    await expect(page.locator('[data-tk="todo-tickets"]')).toHaveCount(0);
    await expect(page.locator('[data-tk="todo-recharges"]')).toHaveCount(0);
    await expect(page.locator('[data-tk="launch-checklist"]')).toHaveCount(0);
    await expect(page.getByText("Credits sold today")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Start reviewing" })).toBeVisible();
  });

  test("the Users screen has one H1 and the top bar prints its title as plain text", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/users/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Users");
    await expect(page.locator('[data-tk="shell-title"]')).toHaveText("Users");
  });
});

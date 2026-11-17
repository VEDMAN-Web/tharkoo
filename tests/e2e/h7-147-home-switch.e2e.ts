import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

const SHOTS = process.env.H7147_SHOTS_DIR || "";

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

const switchIsOn = async () => (await withLocalDb((db) => db.collection("sites").findOne({ key: "default" }, { projection: { homeFromLayout: 1 } })))?.homeFromLayout === true;
const resetSwitch = () => withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { homeFromLayout: false } }, { upsert: true }));

test.describe("H7.147 the Home switch in the Page builder", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("off by default; turning it on asks first and names the version; the toast Undo turns it off; Turn off works; the audit log has both", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await resetSwitch();
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/page-builder/");
    const box = page.locator('[data-tk="home-switch"]');
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute("data-on", "no");
    await expect(box.getByRole("switch", { name: "Draw the Home page from the Page builder" })).toHaveAttribute("aria-checked", "false");
    await expect(page.locator('[data-tk="home-switch-state"]')).toContainText("Off: visitors see today's Home page");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/switch-off-1440x900.png` });
    }

    await box.getByRole("switch").click();
    const dialog = page.locator('[data-tk="home-switch-dialog"]');
    await expect(dialog).toContainText(/Visitors will see the published version \d+ now/);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/switch-confirm-1440x900.png` });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    expect(await switchIsOn()).toBe(false);

    await box.getByRole("switch").click();
    await dialog.getByRole("button", { name: "Turn on" }).click();
    await expect(box).toHaveAttribute("data-on", "yes");
    await expect.poll(switchIsOn, { timeout: 15_000 }).toBe(true);
    await expect(page.locator('[data-tk="toast"]')).toContainText("Visitors now see the published version");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/switch-on-1440x900.png` });

    await page.locator('[data-tk="toast-undo"]').click();
    await expect.poll(switchIsOn, { timeout: 15_000 }).toBe(false);
    await page.reload();
    await expect(page.locator('[data-tk="home-switch"]')).toHaveAttribute("data-on", "no");

    await page.locator('[data-tk="home-switch"]').getByRole("switch").click();
    await page.locator('[data-tk="home-switch-dialog"]').getByRole("button", { name: "Turn on" }).click();
    await expect.poll(switchIsOn, { timeout: 15_000 }).toBe(true);
    await page.locator('[data-tk="home-switch"]').getByRole("switch").click();
    await expect.poll(switchIsOn, { timeout: 15_000 }).toBe(false);
    await expect(page.locator('[data-tk="toast"]')).toContainText("today's Home page again");

    await page.goto("/admin/history/?type=settings&days=0");
    await expect(page.getByText("Turned on drawing the Home page from the Page builder").first()).toBeVisible();
    await expect(page.getByText("Turned off drawing the Home page from the Page builder").first()).toBeVisible();
    await resetSwitch();
  });

  test("on a phone the switch fits, and the confirm dialog is usable", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await resetSwitch();
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/page-builder/");
    const box = page.locator('[data-tk="home-switch"]');
    await expect(box).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    expect((await box.getByRole("switch").boundingBox())!.height).toBeGreaterThanOrEqual(24);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/switch-off-390x844.png` });
    await box.getByRole("switch").click();
    await expect(page.locator('[data-tk="home-switch-dialog"]')).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/switch-confirm-390x844.png` });
    await page.locator('[data-tk="home-switch-dialog"]').getByRole("button", { name: "Cancel" }).click();
    await resetSwitch();
  });
});

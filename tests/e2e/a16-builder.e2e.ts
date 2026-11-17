import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, setRoles, signInAdminContext, test, uniqueEmail, withLocalDb } from "./helpers";

const SHOTS = process.env.A16_SHOTS_DIR || "";
const BUILDER = "/admin/page-builder/";

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

async function setSwitch(on: boolean) {
  await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { homeFromLayout: on } }, { upsert: true }));
}

async function openBuilder(page: Page) {
  await page.goto(BUILDER);
  await expect(page.locator('[data-tk="home-builder"]')).toBeVisible();
}

async function headline(page: Page) {
  return page.getByRole("textbox", { name: /Headline \(H1/ });
}

async function homeH1(page: Page) {
  await page.goto("/");
  return (await page.getByRole("heading", { level: 1 }).first().innerText()).replace(/\s+/g, " ").trim();
}

async function liveVersion(page: Page) {
  const text = (await page.locator('[data-tk="builder-status"]').innerText()).replace(/\s+/g, " ");
  const found = /Live: version (\d+)/.exec(text);
  return found ? Number(found[1]) : 0;
}

async function publishNow(page: Page) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish now" }).click();
}

test.describe("A16 page builder, Home tab", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("one H1, five blocks, a field set for each, the 8 slots, no sideways scroll, axe 0 at laptop and phone size", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBuilder(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page builder");
    await expect(page.getByRole("tab")).toHaveText(["Home", "Listing pages", "Post-ad page"]);
    await expect(page.locator('[data-tk="block-list"] li')).toHaveCount(5);
    for (const type of ["homeBanner", "homeCategories", "homeAds", "homeSteps", "homeTrust"]) await expect(page.locator(`[data-tk="block-card-${type}"]`)).toBeVisible();
    await expect(page.locator('[data-tk="banner-fields"]').getByText("Picture description (alt text)")).toBeVisible();
    await expect(page.locator('[data-tk="home-slots"] li')).toHaveCount(8);
    await expect(page.locator('[data-tk="preview"] iframe')).toBeVisible();
    await expect(page.locator('[data-tk="builder-status"]')).toContainText(/Nothing published from here yet|Live: version \d+/);
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/builder-1440x900.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await openBuilder(page);
    await expect(page.locator('[data-tk="preview"]')).toBeHidden();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/builder-390x844.png`, fullPage: true });
    for (const toggle of await page.locator('[data-tk="block-list"] button[role=switch]').all()) expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  });

  test("a banner picture with no description cannot be saved or published", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBuilder(page);
    const alt = page.locator('[data-tk="banner-fields"]').getByLabel(/Picture description \(alt text\)/);
    await alt.fill("");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator('[data-tk="problems"]')).toContainText("needs attention");
    await expect(page.locator('[data-tk="banner-fields"]')).toContainText("Describe the picture");
    await alt.fill("People meeting in a city");
    await expect(page.locator('[data-tk="problems"]')).toHaveCount(0);
  });

  test("change the headline, publish, see it on Home with the switch on, undo, restore an old version, switch off again", async ({ page, context, baseURL }) => {
    test.setTimeout(600_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await setSwitch(false);
    const today = await homeH1(page);

    await openBuilder(page);
    const v0 = await liveVersion(page);
    await (await headline(page)).fill("A16 first headline");
    await expect(page.locator('[data-tk="builder-status"]')).toContainText("1 change");
    await expect(page.locator('[data-tk="save-bar"]')).toContainText(/Draft saved (just now|\d+ s ago)/, { timeout: 30_000 });
    await expect(page.locator('[data-tk="save-bar"]')).toHaveAttribute("data-dirty", "no");
    await publishNow(page);
    await expect(page.locator('[data-tk="builder-status"]')).toContainText(`Live: version ${v0 + 1}`);
    await expect(page.locator('[data-tk="toast"]')).toContainText(`Published as version ${v0 + 1}`);
    await expect(page.locator('[data-tk="toast-undo"]')).toHaveCount(v0 > 0 ? 1 : 0);

    await (await headline(page)).fill("A16 second headline");
    await publishNow(page);
    await expect(page.locator('[data-tk="builder-status"]')).toContainText(`Live: version ${v0 + 2}`);
    await expect(page.locator('[data-tk="versions"]')).toContainText(`v${v0 + 1}`);

    await setSwitch(true);
    await expect.poll(async () => homeH1(page), { timeout: 240_000, intervals: [5_000], message: "Home shows the published headline once the switch is on" }).toBe("A16 second headline");
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/home-switch-on-1440x900.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await page.screenshot({ path: `${SHOTS}/home-switch-on-390x844.png`, fullPage: true });
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    await openBuilder(page);
    await (await headline(page)).fill("A16 third headline");
    await publishNow(page);
    await expect(page.locator('[data-tk="builder-status"]')).toContainText(`Live: version ${v0 + 3}`);
    await page.locator('[data-tk="toast-undo"]').click();
    await expect(page.locator('[data-tk="toast"]')).toContainText("previous version is live again");
    await expect(page.locator('[data-tk="builder-status"]')).toContainText(`Live: version ${v0 + 4}`);
    await expect(await headline(page)).toHaveValue("A16 second headline");
    await expect.poll(async () => homeH1(page), { timeout: 240_000, intervals: [5_000] }).toBe("A16 second headline");

    await openBuilder(page);
    await page.locator('[data-tk="versions"]').getByRole("button", { name: "All versions" }).click();
    await page.locator('[data-tk="version"]').filter({ hasText: new RegExp(`^v${v0 + 1}(?![0-9])`) }).getByRole("button", { name: "Restore" }).click();
    await expect(await headline(page)).toHaveValue("A16 first headline");
    await expect(page.locator('[data-tk="builder-status"]')).toContainText(`Live: version ${v0 + 4}`);

    await setSwitch(false);
    await expect.poll(async () => homeH1(page), { timeout: 240_000, intervals: [5_000], message: "Home goes back to today's page with the switch off" }).toBe(today);
  });

  test("pick an ad for a slot, move it, remove it and take the removal back, with Undo", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBuilder(page);
    const slots = page.locator('[data-tk="home-slots"]');
    const filled = slots.locator('[data-tk="slot-filled"]');
    const before = await filled.count();
    await slots.getByRole("button", { name: "Pick an ad" }).first().click();
    const results = page.locator('[data-tk="slot-results"] li');
    await expect(results.first()).toBeVisible();
    await results.first().getByRole("button", { name: /Put in slot/ }).click();
    await expect(page.locator('[data-tk="toast"]')).toContainText(`Put in slot ${before + 1}`);
    await expect(filled).toHaveCount(before + 1);
    await expect(filled.nth(before)).toContainText(/Real|Demo/);
    await page.reload();
    await expect(page.locator('[data-tk="home-slots"] [data-tk="slot-filled"]')).toHaveCount(before + 1);
    await page.locator('[data-tk="home-slots"] [data-tk="slot-filled"]').last().getByRole("button", { name: /^Remove / }).click();
    await expect(page.locator('[data-tk="toast"]')).toContainText("Removed from slot");
    await expect(page.locator('[data-tk="home-slots"] [data-tk="slot-filled"]')).toHaveCount(before);
    await page.locator('[data-tk="toast-undo"]').click();
    await expect(page.locator('[data-tk="home-slots"] [data-tk="slot-filled"]')).toHaveCount(before + 1);
    await page.locator('[data-tk="home-slots"] [data-tk="slot-filled"]').last().getByRole("button", { name: /^Remove / }).click();
    await expect(page.locator('[data-tk="home-slots"] [data-tk="slot-filled"]')).toHaveCount(before);
  });

  test("a moderator gets the 403 page", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const email = uniqueEmail("a16mod");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    const promoted = await setRoles(email, ["moderator"]);
    test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    await loginUi(page, email, undefined, "/admin/");
    const answer = await page.goto(BUILDER);
    expect(answer?.status()).toBe(403);
  });
});

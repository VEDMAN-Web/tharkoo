import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { BrowserContext, Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, resetPageLayouts, setIdCheckSwitch, signInAdminContext, test, uniqueEmail, withLocalDb } from "./helpers";

const SHOTS = process.env.A41_SHOTS_DIR || "";
const BUILDER = "/admin/page-builder/";
const PARTS = ["postIntro", "postStep", "photoRules", "promotionPicker", "postSuccess", "idCheckFirst", "payStep", "consent"];

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

async function openPostTab(page: Page) {
  await page.goto(BUILDER);
  await page.getByRole("tab", { name: "Post-ad page" }).click();
  await expect(page.locator('[data-tk="post-builder"]')).toBeVisible();
}

const MONEY_FIELDS = ["paidPostingOn", "postingFeeCredits", "freeAdsPerAccount"] as const;

async function setMoney(paid: boolean) {
  await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { paidPostingOn: paid, postingFeeCredits: 30, freeAdsPerAccount: 0 } }, { upsert: true }));
}

/** What the money settings were before the test, so the test can put them back exactly (a field that was not set is removed again). */
async function moneyNow() {
  const row = await withLocalDb((db) => db.collection("sites").findOne({ key: "default" }, { projection: { paidPostingOn: 1, postingFeeCredits: 1, freeAdsPerAccount: 1 } }));
  return row ?? {};
}

async function restoreMoney(before: Record<string, unknown>) {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  for (const field of MONEY_FIELDS) {
    if (field in before) set[field] = before[field];
    else unset[field] = "";
  }
  await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) }));
}

test.describe("A41 page builder, Post-ad tab", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("one H1, a card for every part, no sideways scroll, axe 0 at laptop and phone size", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    for (const [width, height, name] of [[1440, 900, "1440x900"], [390, 844, "390x844"]] as const) {
      await page.setViewportSize({ width, height });
      await openPostTab(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page builder");
      for (const type of PARTS) await expect(page.locator(`[data-tk="block-card-${type}"]`).first()).toBeVisible();
      await expect(page.locator('[data-tk="block-card-postStep"]')).toHaveCount(6);
      await expect(page.locator('[data-tk="block-row-postStep"]').first()).toContainText("Always on");
      await expect(page.getByRole("link", { name: "Preview the saved draft" })).toHaveAttribute("href", "/u/post-insert/?preview=1");
      await expect(page.locator('[data-tk="payStep-fields"] input').first()).toHaveAttribute("placeholder", "Pay and publish");
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${SHOTS}/post-tab-${name}.png`, fullPage: true });
        await page.screenshot({ path: `${SHOTS}/post-tab-top-${name}.png` });
      }
      for (const toggle of await page.locator('[data-tk="block-list"] button[role=switch]').all()) expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    }
  });

  test("a step with no title cannot be saved", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPostTab(page);
    const title = page.locator('[data-tk="block-card-postStep"]').first().getByRole("textbox", { name: /^Title/ });
    await title.fill("");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator('[data-tk="problems"]')).toContainText("needs attention");
    await expect(page.locator('[data-tk="block-card-postStep"]').first()).toContainText("Write a title");
  });

  test("texts written in the tab reach the post-ad page, with {fee} filled from the money settings", async ({ page, context, browser, baseURL }) => {
    test.setTimeout(420_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    const moneyBefore = await moneyNow();
    let visitor: BrowserContext | null = null;
    let seen: Page | null = null;
    await setMoney(true);
    try {
      await openPostTab(page);
      await page.locator('[data-tk="block-card-postStep"]').first().getByRole("textbox", { name: /^Help line/ }).fill("Posting costs {fee} to start.");
      await page.locator('[data-tk="idCheckFirst-fields"]').getByRole("textbox", { name: "Title when an ID check is needed" }).fill("Send us your ID first");
      await expect(page.locator('[data-tk="save-bar"]')).toHaveAttribute("data-dirty", "no", { timeout: 30_000 });
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Publish now" }).click();
      await expect(page.locator('[data-tk="builder-status"]')).toContainText(/Live: version \d+/);

      const context2 = await browser.newContext({ baseURL });
      const seen2 = await context2.newPage();
      visitor = context2;
      seen = seen2;
      const api = await newApi(baseURL!);
      const email = uniqueEmail("a41");
      await registerApi(api, baseURL!, email);
      await api.dispose();
      await loginUi(seen2, email, undefined, "/u/post-insert/");
      await expect(async () => {
        await seen2.goto("/u/post-insert/");
        await expect(seen2.locator('[data-tk="step-help"], .tkp-help').first()).toContainText("Posting costs 30 credits to start.", { timeout: 3_000 });
      }).toPass({ timeout: 240_000, intervals: [5_000] });
      if (SHOTS) await seen2.screenshot({ path: `${SHOTS}/post-page-fee-1440x900.png` });

      await setIdCheckSwitch(baseURL!, true);
      try {
        await expect(async () => {
          await seen2.goto("/u/post-insert/");
          await expect(seen2.locator('[data-tk="id-check-first"] h1')).toHaveText("Send us your ID first", { timeout: 3_000 });
        }).toPass({ timeout: 240_000, intervals: [5_000] });
        await expect(seen2.locator('[data-tk="verify-id"]')).toHaveText("Verify ID");
      } finally {
        await setIdCheckSwitch(baseURL!, false);
      }
    } finally {
      await restoreMoney(moneyBefore);
      // Leave no published Post-ad layout behind: "Posting costs {fee} credits to start" would show on every later post-ad test.
      await resetPageLayouts("post");
      // The site keeps the live layout for a short while; wait until the standard text is back before the next test.
      if (seen) {
        const page = seen;
        await expect(async () => {
          await page.goto("/u/post-insert/");
          await expect(page.locator('[data-tk="step-help"], .tkp-help').first()).not.toContainText("Posting costs", { timeout: 3_000 });
        }).toPass({ timeout: 180_000, intervals: [5_000] });
      }
      await visitor?.close();
    }
  });
});

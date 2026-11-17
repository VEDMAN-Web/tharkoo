import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

const SHOTS = process.env.A19_SHOTS_DIR || "";

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

async function setSwitch(on: boolean) {
  await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { homeFromLayout: on } }, { upsert: true }));
}

async function publishNow(page: Page) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish now" }).click();
}

test.describe("A19 the old Home writers are retired", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("/admin/homepage points to the Page builder, shows the banner facts read only, and keeps the Home title, login picture and listing band", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/homepage/");
    await expect(page.locator('[data-tk="home-moved"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the Page builder" })).toHaveAttribute("href", "/admin/page-builder/");
    await expect(page.getByText("What Home shows today (read only)")).toBeVisible();
    await expect(page.getByLabel("Number of categories on Home (1 to 8)")).toHaveCount(0);
    await expect(page.getByLabel("The headline is already in the picture")).toHaveCount(0);
    await expect(page.locator("li.lay-block")).toHaveCount(0);
    await expect(page.getByLabel("Show photo band on listing pages")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/homepage-1440x900.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/admin/homepage/");
      await page.screenshot({ path: `${SHOTS}/homepage-390x844.png`, fullPage: true });
    }
    await page.getByRole("link", { name: "Open the Page builder" }).click();
    await expect(page).toHaveURL(/\/admin\/page-builder\/$/);
  });

  test("Menus no longer shows the old read-only Home page block (the Page builder owns those words)", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/menus/");
    await expect(page.locator('[data-tk="menus-screen"]')).toBeVisible();
    await expect(page.locator('[data-tk="home-blocks-moved"]')).toHaveCount(0);
    await expect(page.locator('[data-tk="home-blocks-readonly"]')).toHaveCount(0);
    await expect(page.getByText("Home page (New design)")).toHaveCount(0);
    await expect(page.getByText("Ads live for 72 hours")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a pill" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a step" })).toHaveCount(0);
  });

  test("the Page builder now does what the old banner and category fields did: picture text, number of categories, then Home follows", async ({ page, context, baseURL }) => {
    test.setTimeout(600_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await setSwitch(false);
    await page.goto("/admin/page-builder/");
    await expect(page.locator('[data-tk="home-builder"]')).toBeVisible();
    const inPicture = page.getByRole("switch", { name: "The headline is part of the picture" });
    await expect(inPicture).toHaveAttribute("aria-checked", "false");
    await inPicture.click();
    const more = page.getByRole("button", { name: "Show one more category" });
    const start = Number(await page.locator('[data-tk="categories-fields"] [data-tk="stepper-value"]').innerText());
    await more.click();
    await more.click();
    await expect(page.locator('[data-tk="categories-fields"] [data-tk="stepper-value"]')).toHaveText(String(start + 2));
    await publishNow(page);
    await expect(page.locator('[data-tk="toast"]')).toContainText("Published as version");
    await setSwitch(true);
    try {
      await expect(async () => {
        await page.goto("/");
        await expect(page.locator('.tkh-banner[data-text-in-image="true"]')).toHaveCount(1, { timeout: 2_000 });
        await expect(page.locator(".tkh-cats > li")).toHaveCount(start + 2, { timeout: 2_000 });
      }).toPass({ timeout: 240_000, intervals: [5_000] });
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    } finally {
      await page.goto("/admin/page-builder/");
      await expect(page.locator('[data-tk="home-builder"]')).toBeVisible();
      const back = page.getByRole("switch", { name: "The headline is part of the picture" });
      if ((await back.getAttribute("aria-checked")) === "true") await back.click();
      const fewer = page.getByRole("button", { name: "Show one fewer category" });
      const now = Number(await page.locator('[data-tk="categories-fields"] [data-tk="stepper-value"]').innerText());
      for (let step = now; step > start; step -= 1) await fewer.click();
      await publishNow(page);
      await expect(page.locator('[data-tk="toast"]')).toContainText("Published as version");
      await setSwitch(false);
    }
  });
});

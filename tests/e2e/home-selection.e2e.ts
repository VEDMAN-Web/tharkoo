import { mkdirSync } from "node:fs";
import { expect, signInAdminContext, test } from "./helpers";

const SHOTS = process.env.PICKER_SHOTS_DIR || "";

test.describe("H7.98 pick the ads on Home", () => {
  test("search for ads, tick two, save once, and they come first on Home", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin screens are for wide screens");
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/ads/");
    const section = page.locator('[data-tk="home-selection"]');
    await expect(section).toBeVisible();
    const pinned = section.locator('[data-tk="home-pinned"]');
    await expect(pinned).toContainText("On the Home page now (0 of 8)");

    await section.getByRole("searchbox").fill("puducherry");
    await section.getByRole("button", { name: "Search" }).click();
    await expect(section.getByText(/ads found\./)).toBeVisible();
    const rows = section.locator('[data-tk="home-row"]');
    expect(await rows.count()).toBeLessThanOrEqual(20);
    const thumb = (await rows.first().locator('[data-tk="home-thumb"]').boundingBox())!;
    expect(Math.round(thumb.width)).toBe(48);
    expect(Math.round(thumb.height)).toBe(48);

    const firstRow = rows.nth(0);
    const secondRow = rows.nth(1);
    const firstId = await firstRow.getByRole("spinbutton").getAttribute("id");
    const secondId = await secondRow.getByRole("spinbutton").getAttribute("id");
    const firstTitle = (await firstRow.locator("strong").innerText()).trim();
    const secondTitle = (await secondRow.locator("strong").innerText()).trim();
    const rowOf = (id: string | null) => section.locator("tr", { has: page.locator("#" + id) }).first();
    await rowOf(firstId).getByRole("checkbox", { name: "Show on Home" }).check();
    await section.locator("#" + firstId).fill("1");
    await rowOf(secondId).getByRole("checkbox", { name: "Show on Home" }).check();
    await section.locator("#" + secondId).fill("2");
    await expect(pinned).toContainText("On the Home page now (2 of 8)");
    await expect(section.getByText("2 changes not saved yet.")).toBeVisible();
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await section.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/4-1c-picker-1440.png` });
    }
    await section.getByRole("button", { name: "Save changes" }).click();
    await expect(section.getByText("Saved. 2 ads changed.")).toBeVisible();
    await expect(section.getByText("Nothing to save.")).toBeVisible();

    try {
      await expect(async () => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        // The full titles, in the order typed: a prefix is not enough, many demo ads start with the same words.
        const shown = page.locator("[data-tk=home-ad] .tkh-ad-title");
        await expect(shown.nth(0)).toHaveText(firstTitle, { timeout: 2000 });
        await expect(shown.nth(1)).toHaveText(secondTitle, { timeout: 2000 });
      }).toPass({ timeout: 30000 });
    } finally {
      await page.goto("/admin/ads/");
      const again = page.locator('[data-tk="home-selection"]');
      await expect(again.locator('[data-tk="home-pinned"]')).toContainText("(2 of 8)");
      const boxes = again.locator('[data-tk="home-row"]').getByRole("checkbox", { name: "Show on Home" });
      await boxes.nth(1).uncheck();
      await boxes.nth(0).uncheck();
      await again.getByRole("button", { name: "Save changes" }).click();
      await expect(again.getByText("Saved. 2 ads changed.")).toBeVisible();
    }
  });
});

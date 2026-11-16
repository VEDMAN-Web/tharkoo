import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, signInAdminContext, test, withLocalDb } from "./helpers";

const SHOTS = process.env.LAUNCH_SHOTS_DIR || "";

async function setCategoryTour(enabled: boolean) {
  await withLocalDb((db) => db.collection("categories").updateOne({ slug: "property" }, { $set: { videoTourEnabled: enabled, videoTourCoins: 2 } }));
}

async function toggle(page: Page, label: RegExp, on: boolean) {
  const box = page.locator('[data-tk="launch-switches"]').getByRole("switch", { name: label });
  await box.scrollIntoViewIfNeeded();
  if ((await box.getAttribute("aria-checked")) !== String(on)) {
    await box.click();
    await expect(page.locator('[data-tk="launch-switches"]').getByText(/^Saved/)).toBeVisible();
  }
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test.describe("H7.95 launch switches", () => {
  test("with both switches off the pack picker and the video call show Coming soon, and back on they work", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin screens are for wide screens");
    await signInAdminContext(context, baseURL!);
    await setCategoryTour(true);
    try {
      await page.goto("/admin/settings/");
      const section = page.locator('[data-tk="launch-switches"]');
      await expect(section).toBeVisible();
      await toggle(page, /Credit purchases/, false);
      await toggle(page, /Video calls/, false);

      await page.goto("/property/bengaluru/");
      const href = await page.locator('[data-tk=card] a[href*="/ad/"]').first().getAttribute("href");
      for (const [width, height] of [
        [1440, 900],
        [1536, 674],
        [390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.goto("/u/account/credits/");
        await expect(page.locator('[data-tk="pack"]').first()).toBeVisible();
        await expect(page.getByRole("button", { name: /^Pay / })).toHaveCount(0);
        await expect(page.locator('[data-tk="coming-soon"]').first()).toBeVisible();
        await page.locator('[data-tk="coming-soon"]').first().scrollIntoViewIfNeeded();
        await shot(page, `5-2-credits-off-${width}`);

        await page.goto(href!);
        const scope = page.locator(width < 1024 ? "[data-tk=bottom-bar]" : "[data-tk=contact-card]");
        const tour = scope.locator("[data-tk=tour]");
        await expect(tour).toBeDisabled();
        await expect(tour.locator('[data-tk="coming-soon"]')).toBeVisible();
        await shot(page, `5-2-ad-video-off-${width}`);
      }

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/admin/settings/");
      await toggle(page, /Credit purchases/, true);
      await toggle(page, /Video calls/, true);
      await page.goto("/u/account/credits/");
      await expect(page.locator('[data-tk="pack"]').first()).toBeVisible();
      await page.locator('[data-tk="pack"]').first().click();
      await expect(page.getByRole("button", { name: /^Pay / })).toBeVisible();
      await page.goto(href!);
      await expect(page.locator("[data-tk=contact-card] [data-tk=tour]")).toBeEnabled();
    } finally {
      await setCategoryTour(false);
    }
  });
});

import AxeBuilder from "@axe-core/playwright";
import { expect, hasHorizontalScroll, PNG, signInAdminContext, test } from "./helpers";

/** H7.8: the shared upload box on the create-ad screen, and the (i) help on the logo field. */
const MB = 1024 * 1024;
const SHOTS = "D:/Skokka/Final Tharkoo/.relay/shots";

test.describe("H7.8 shared uploader", () => {
  test("create ad photos: help popover, several files, too-big file refused, remove, move", async ({ page, context, baseURL }, testInfo) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/ads/create/");
    await expect(page.locator("h1")).toHaveCount(1);

    const photos = page.locator("section[aria-labelledby='ad-photos-h']");
    await page.getByLabel("Category *").selectOption({ index: 1 });

    // The (i) button opens the rules, Escape closes it and returns focus to the button.
    const info = photos.getByRole("button", { name: "About Photos" });
    await expect(info).toHaveAttribute("aria-expanded", "false");
    await info.click();
    await expect(info).toHaveAttribute("aria-expanded", "true");
    await expect(photos.getByText("Best size: 1200 x 1500 px (tall).")).toBeVisible();
    await photos.screenshot({ path: `${SHOTS}/h7.8-admin-photos-popover-${testInfo.project.name}.png` });
    await page.keyboard.press("Escape");
    await expect(info).toHaveAttribute("aria-expanded", "false");
    await expect(info).toBeFocused();

    // Three files at once, plus one photo that is too big. The too-big file gets its own message; the others upload.
    const big = Buffer.concat([PNG, Buffer.alloc(9 * MB)]);
    await photos.locator("input[type=file]").setInputFiles([
      { name: "photo-1.png", mimeType: "image/png", buffer: PNG },
      { name: "photo-2.png", mimeType: "image/png", buffer: PNG },
      { name: "photo-3.png", mimeType: "image/png", buffer: PNG },
      { name: "too-big.png", mimeType: "image/png", buffer: big },
    ]);
    await expect(photos.getByText("This photo is 9 MB. The limit is 8 MB.")).toBeVisible();
    await expect(photos.locator("[data-state=ready]")).toHaveCount(3, { timeout: 30_000 });
    // The refused file does not count: three photos are counted, not four.
    await expect(photos.locator("[data-tk=upload-count]")).toHaveText(/^3 of \d+$/);
    await expect(photos.locator(".upl-cover")).toHaveText("Cover");
    await expect(photos.locator("li", { hasText: "photo-1.png" }).getByText(/ · Ready$/)).toBeVisible();

    // A refused tile has only Remove: no move or cover buttons.
    const refused = photos.locator("li", { hasText: "too-big.png" });
    await expect(refused.getByRole("button", { name: "Move too-big.png earlier" })).toHaveCount(0);
    await expect(refused.getByRole("button", { name: "Make too-big.png the cover" })).toHaveCount(0);
    await expect(refused.getByRole("button", { name: "Remove too-big.png" })).toBeVisible();

    // Remove one, then move the last photo earlier.
    await photos.getByRole("button", { name: "Remove photo-2.png" }).click();
    await expect(photos.locator("[data-tk=upload-count]")).toHaveText(/^2 of \d+$/);
    await photos.getByRole("button", { name: "Move photo-3.png earlier" }).click();
    const names = await photos.locator(".upl-name").allTextContents();
    expect(names).toEqual(["photo-3.png", "photo-1.png", "too-big.png"]);
    await photos.screenshot({ path: `${SHOTS}/h7.8-admin-photos-after-${testInfo.project.name}.png` });

    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("logo field: the size help and its (i) button", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/seo/settings/");
    await expect(page.locator("h1")).toHaveCount(1);
    const info = page.getByRole("button", { name: "About Logo" });
    await info.click();
    await expect(page.getByText("Square, 512 x 512 px.").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(info).toHaveAttribute("aria-expanded", "false");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("axe: the create-ad and logo screens have no serious or critical issues", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    for (const path of ["/admin/ads/create/", "/admin/seo/settings/"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      const result = await new AxeBuilder({ page }).analyze();
      const serious = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
      expect(
        serious.map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(" ")).join(" | ")}`),
        path,
      ).toEqual([]);
    }
  });
});

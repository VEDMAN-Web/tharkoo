import AxeBuilder from "@axe-core/playwright";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

const SIZES = [
  { width: 1536, height: 674 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 740 },
];

test.describe("H7.105: new logo and banner", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  for (const size of SIZES) {
    test(`the logo shows in the header and the footer at ${size.width}x${size.height} with its size set`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/");
      const header = page.locator('[data-tk="header"] img[data-tk="logo"]');
      await expect(header).toHaveAttribute("alt", "Tharkoo");
      await expect(header).toHaveAttribute("src", "/brand/logo-horizontal.png");
      const high = size.width < 390 ? 32 : 40;
      const box = (await header.boundingBox())!;
      expect(Math.round(box.height)).toBe(high);
      expect(Math.abs(box.width / box.height - 1224 / 386)).toBeLessThan(0.02);
      expect(await header.evaluate((img: HTMLImageElement) => img.naturalWidth > 0 && img.complete)).toBe(true);
      expect(await header.getAttribute("width")).toBeTruthy();
      expect(await header.getAttribute("height")).toBeTruthy();
      await expect(page.locator('[data-tk="header"] a[aria-label="Tharkoo, home"]')).toHaveAttribute("href", "/");
      const footer = page.locator('[data-tk="footer"] img[data-tk="logo"]');
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toHaveAttribute("alt", "Tharkoo");
      expect(await footer.evaluate((img: HTMLImageElement) => img.naturalWidth > 0)).toBe(true);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }

  test("the home page keeps exactly one h1 and passes axe with the logo", async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 674 });
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    const issues = (await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id);
    expect(issues).toEqual([]);
  });

  test("the icons and the social image are the new brand files", async ({ request }) => {
    for (const path of ["/favicon.ico", "/brand/icon-192.png", "/brand/icon-512.png", "/apple-touch-icon.png", "/brand/logo-mark-512.png", "/brand/logo-horizontal-white.png"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
    }
    const og = await request.get("/brand/og-default.png");
    expect(og.status()).toBe(200);
    expect((await og.body()).length).toBeGreaterThan(5_000);
  });

  test("admin Settings has the two logo pickers", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/settings/");
    await expect(page.locator(".adm-field-label", { hasText: "Logo (light backgrounds)" })).toBeVisible();
    await expect(page.locator(".adm-field-label", { hasText: "Logo (dark backgrounds)" })).toBeVisible();
  });

});

import { expect, signInAdminContext, test } from "./helpers";

test.describe("H7.87 ads on the Home page", () => {
  test("an admin ticks an ad for Home and it comes first in the Latest ads row", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin screens are for wide screens");
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/ads/");
    const section = page.locator('[data-tk="home-selection"]');
    await expect(section).toBeVisible();
    const last = section.locator("tbody tr").filter({ hasText: "active" }).last();
    const title = ((await last.locator("td").first().innerText()) || "").trim();
    expect(title.length).toBeGreaterThan(0);
    await last.getByRole("checkbox", { name: "Show on Home" }).check();
    await last.getByRole("spinbutton").fill("0");
    await last.getByRole("button", { name: "Save" }).click();
    await expect(section.getByRole("status")).toContainText("Saved");
    try {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const first = page.locator("[data-tk=home-ad]").first();
      await expect(first).toBeVisible();
      await expect(first.locator(".tkh-ad-title")).toContainText(title.slice(0, 12));
    } finally {
      await page.goto("/admin/ads/");
      const checked = page.locator('[data-tk="home-selection"] tbody tr').filter({ has: page.locator("input[type=checkbox]:checked") }).first();
      const inputId = await checked.getByRole("spinbutton").getAttribute("id");
      const again = page.locator('[data-tk="home-selection"] tbody tr').filter({ has: page.locator("#" + inputId) });
      await again.getByRole("checkbox", { name: "Show on Home" }).uncheck();
      await again.getByRole("button", { name: "Save" }).click();
      await expect(page.locator('[data-tk="home-selection"]').getByRole("status")).toContainText("Saved");
    }
  });
});

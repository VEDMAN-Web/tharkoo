import { expect, signInAdminContext, test } from "./helpers";
import { roleTests } from "./e1c-roles-core";

/**
 * H15.13 (three small admin fixes from E1-C):
 * C1: a menu item shows only for roles that can open it (Media library is for content_editor and admins).
 * C3: the History Export button is a plain download link, so the page settles instead of prefetching a file forever.
 * C5: the Page builder preview frames our own pages without a console error.
 */

test.describe("H15.13 C1: the menu follows permissions", () => {
  roleTests(["blog_editor", "seo_editor"]);
});

test.describe("H15.13 C3: History Export", () => {
  test("Export is a download link and the History page reaches network idle", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const pending: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/history/export/")) pending.push(request.url());
    });
    await page.goto("/admin/history/", { waitUntil: "networkidle", timeout: 30_000 });
    const phone = (page.viewportSize()?.width ?? 1440) < 768;
    if (phone) await page.getByRole("button", { name: "More" }).first().click();
    const link = phone ? page.getByRole("menuitem", { name: "Export" }) : page.getByRole("link", { name: "Export" });
    await expect(link).toHaveAttribute("download", "");
    await expect(link).toHaveAttribute("href", /\/admin\/history\/export\//);
    expect(pending, "the export file is not fetched until someone presses Export").toEqual([]);
  });
});

test.describe("H15.13 C5: Page builder console", () => {
  test("the Home and Listing preview frames raise no console error", async ({ page, context, baseURL }) => {
    test.skip((page.viewportSize()?.width ?? 1440) < 768, "the preview is hidden on a phone");
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource.*(403|404|410)/i.test(message.text())) problems.push(message.text().slice(0, 160));
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message.slice(0, 160)}`));
    await page.goto("/admin/page-builder/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-tk="preview"] iframe')).toBeVisible();
    await page.waitForTimeout(2500);
    await page.goto("/admin/page-builder/?tab=listing", { waitUntil: "networkidle" });
    await expect(page.locator('[data-tk="preview"] iframe')).toBeVisible();
    await page.waitForTimeout(2500);
    expect(problems).toEqual([]);
  });
});

import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

test.describe("H6.15 admin create ad", () => {
  test("Create ad and Bulk import links are in the sidebar, and the screen fits a phone", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/ads/create/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "1. Who is the ad for" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create ad" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.goto("/admin/import/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Bulk import" })).toBeVisible();
  });

  test("the category form shows the Max photos control", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/categories/");
    await expect(page.getByText("Max photos for admin posts and imports (1 to 30)").first()).toBeVisible();
  });
});

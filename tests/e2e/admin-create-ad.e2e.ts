import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

test.describe("H6.15 admin create ad", () => {
  test("Create ad and Bulk import screens open from their address, and the create screen fits a phone", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/ads/create/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "1. Who is the ad for" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create ad" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.goto("/admin/import/");
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("the category form shows the Max photos control", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/categories/?c=dating");
    await expect(page.getByText("Max photos for admin posts and imports").first()).toBeVisible();
  });
});

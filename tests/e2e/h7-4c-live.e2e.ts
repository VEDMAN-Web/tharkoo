import { expect, hasHorizontalScroll, isPhone, test } from "./helpers";

/**
 * H7.4c: live fixes from the www review. The country pill (desktop header), the hero search (three selects and the
 * button), and the rule that every menu closes on a click outside it and on Escape.
 */

test.describe("H7.4c: menus close", () => {
  test("the country menu closes on a click outside and on Escape", async ({ page }) => {
    test.skip(isPhone(page), "on phones the country list sits in the drawer");
    await page.goto("/");
    const pill = page.locator("header.tkn-header .tkn-city").first();
    await expect(pill).toBeVisible();
    await pill.click();
    const menu = page.getByRole("group", { name: "Countries" });
    await expect(menu).toBeVisible();
    await page.locator("body").click({ position: { x: 4, y: 600 } });
    await expect(menu).toHaveCount(0);
    await pill.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });
});

test.describe("H7.4c: hero search", () => {
  test("the hero has three selects and the Search button, and no keyword box", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("form.tkh-search");
    await expect(form).toBeVisible();
    await expect(form.locator("select")).toHaveCount(3);
    await expect(form.locator("input")).toHaveCount(0);
    await expect(form.getByRole("button", { name: "Search" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

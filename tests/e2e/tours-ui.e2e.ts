import AxeBuilder from "@axe-core/playwright";
import { expect, firstAdPath, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

// H6.5 live video tours: the admin switch screen, and the ad page of a people listing (no tour button).

test.describe("Live video tours UI", () => {
  test("admin video tours screen: people categories are greyed out and the page is accessible", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/settings/video-tours/");
    await expect(page.getByRole("heading", { name: "Video tours", level: 1 })).toBeVisible();
    await expect(page.getByText("Not available for people listings").first()).toBeVisible();

    const peopleSwitch = page.getByRole("switch", { name: /Live video tours for Dating/ });
    if (await peopleSwitch.count()) await expect(peopleSwitch.first()).toBeDisabled();

    expect(await hasHorizontalScroll(page)).toBe(false);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(serious.map((item) => item.id)).toEqual([]);
  });

  test("admin video tours screen is not shown to a signed-out visitor", async ({ page }) => {
    await page.goto("/admin/settings/video-tours/");
    await expect(page.getByRole("heading", { name: "Video tours", level: 1 })).toHaveCount(0);
  });

  test("ad page of a people listing has no live video tour button", async ({ page }) => {
    const path = await firstAdPath(page, "/dating/bengaluru/");
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Video call and verify/ })).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

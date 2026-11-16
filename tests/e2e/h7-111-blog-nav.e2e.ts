import { expect, test } from "./helpers";

test.describe("H7.111: Blog instead of Help in the header", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  test("the header says Blog, the phone drawer says Blog, and Help stays in the footer", async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 674 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Blog", exact: true })).toHaveAttribute("href", "/blog/");
    await expect(nav.getByRole("link", { name: "Help", exact: true })).toHaveCount(0);
    await expect(page.locator('[data-tk="footer"]').getByRole("link", { name: "Help and support" })).toHaveAttribute("href", "/help/");
    await page.screenshot({ path: "D:/Skokka/Final Tharkoo/.relay/shots/H7.111/header-1536x674.png", clip: { x: 0, y: 0, width: 1536, height: 120 } });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.locator('[data-tk="drawer"]');
    await expect(drawer.getByRole("link", { name: "Blog", exact: true })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Help", exact: true })).toHaveCount(0);
    await page.screenshot({ path: "D:/Skokka/Final Tharkoo/.relay/shots/H7.111/drawer-390x844.png" });
  });
});

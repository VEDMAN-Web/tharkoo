import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SHOTS = process.env.POST_SHOTS ?? "";

test.describe("W1-4 the age gate in a clean browser", () => {
  test("a first visit shows the gate before the cookie notice, the gate is a proper dialog that fits the screen, and accepting is remembered", async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.goto("/");
    const gate = page.locator("[data-tk=age-gate]");
    await expect(gate).toBeVisible();
    await expect(gate).toHaveAttribute("role", "dialog");
    await expect(gate).toHaveAttribute("aria-modal", "true");
    await expect(gate).toContainText("I am over 18 years old");
    await expect(page.locator(".tkc-banner")).toHaveCount(0);

    const box = (await gate.boundingBox())!;
    const view = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height);
    const accept = page.locator("[data-tk=age-accept]");
    expect((await accept.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const found = await new AxeBuilder({ page }).include("[data-tk=age-gate]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id)).toEqual([]);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/w1-4-age-gate-${info.project.name}.png` });

    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest("[data-tk=age-gate]"))), `Tab ${press + 1} stays in the gate`).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(gate).toBeVisible();
    await expect(page.getByRole("link", { name: "Decline" })).toHaveAttribute("href", /^https:\/\//);

    await accept.click();
    await expect(gate).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("nl-age"))).toBe("ok");
    const cookies = page.locator(".tkc-banner");
    await expect(cookies).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/w1-4-cookie-notice-${info.project.name}.png` });
    await page.getByRole("button", { name: "Only necessary" }).click();
    await expect(cookies).toHaveCount(0);

    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-tk=age-gate]")).toHaveCount(0);
    await expect(page.locator(".tkc-banner")).toHaveCount(0);
  });

  test("the gate also shows on a deep link, on the sign-in page and on the post-ad address, and the page content is in the HTML for search engines", async ({ page }) => {
    test.setTimeout(120_000);
    for (const path of ["/dating/mumbai/", "/u/login/", "/categories/"]) {
      await page.goto(path);
      await expect(page.locator("[data-tk=age-gate]"), path).toBeVisible();
    }
    const html = await (await page.request.get("/dating/mumbai/")).text();
    expect(html).toContain("<h1");
    expect(html).not.toContain("data-tk=\"age-gate\"");
  });

  test("declining leaves the site and nothing is stored", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-tk=age-gate]")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("nl-age"))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("nl-cookies"))).toBeNull();
  });
});

import AxeBuilder from "@axe-core/playwright";
import { expect, hasHorizontalScroll, isPhone, signInAdminContext, test } from "./helpers";

/**
 * H7.1: the New design shell. The e2e server is staging (SITE_NOINDEX=true), so the New design is on by default there.
 * Runs at 390 px (phone) and 1440 px (desktop) through the two projects in playwright.config.ts.
 */

test.describe("H7.1 shell: visitor", () => {
  test("home shows the new header, the pill nav, no saved icon and a closed chat bubble", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-design="new"]')).toHaveCount(1);
    const header = page.locator("header.tkn-header");
    await expect(header).toBeVisible();
    // Review #77: below 420 px the button reads "Post ad".
    await expect(header.getByRole("link", { name: /post (your )?ad/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /saved|favourite|favorite/i })).toHaveCount(0);
    if (isPhone(page)) {
      await expect(header.getByRole("button", { name: "Open menu" })).toBeVisible();
    } else {
      await expect(header.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expect(header.getByRole("link", { name: /log in/i })).toBeVisible();
    }
    await expect(page.locator(".tkn-chat-bubble")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".tkn-chatbox")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the footer has quick links and legal pills", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer.tkn-footer");
    await expect(footer.getByRole("navigation", { name: "Quick links" })).toBeVisible();
    await expect(footer.getByRole("navigation", { name: "Legal" })).toBeAttached();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the chat bubble opens the panel and Escape closes it", async ({ page }) => {
    await page.goto("/");
    await page.locator(".tkn-chat-bubble").click();
    await expect(page.locator("#tkn-chat-panel")).toBeVisible();
    await expect(page.locator(".tkn-chat-bubble")).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator("#tkn-chat-panel")).toHaveCount(0);
  });

  test("under 1024 px the burger opens a drawer that closes on Escape", async ({ page }) => {
    test.skip(!isPhone(page), "The burger is for narrow screens");
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: /post your ad/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });

  test("at 390 the header search button sits by the burger and opens the search pop-up", async ({ page }) => {
    test.skip(!isPhone(page), "The phone placement is checked at 390 px");
    await page.goto("/");
    const search = page.locator('header [data-tk="header-search"]');
    const burger = page.getByRole("button", { name: "Open menu" });
    await expect(search).toBeVisible();
    const [searchBox, burgerBox] = await Promise.all([search.boundingBox(), burger.boundingBox()]);
    expect(searchBox && burgerBox && searchBox.x < burgerBox.x).toBe(true);
    await search.click();
    const modal = page.locator('[data-tk="search-modal"]');
    await expect(modal).toBeVisible();
    await modal.locator('[data-tk="search-text"]').fill("coffee");
    await modal.locator('[data-tk="search-submit"]').click();
    await expect(page).toHaveURL(/\/search\/\?.*q=coffee/);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the shell passes axe with no serious or critical issues", async ({ page }) => {
    await page.goto("/");
    const result = await new AxeBuilder({ page })
      .include(".tkn-header")
      .include("footer.tkn-footer")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const bad = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(bad.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
});

test.describe("H7.1 shell: rollback switch", () => {
  test("a superadmin turns the New design off and back on, and the visitor site follows", async ({ page, context, baseURL }) => {
    test.skip(!baseURL, "needs the e2e base URL");
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/settings/");
    const toggle = page.getByRole("switch", { name: "Show the New design to visitors" });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByText(/Saved\. Visitors see the old design again/)).toBeVisible();
    const visitor = await page.context().browser()!.newContext({ baseURL });
    const plain = await visitor.newPage();
    await plain.goto("/");
    await expect(plain.locator('[data-design="new"]')).toHaveCount(0);
    await visitor.close();
    await page.getByRole("switch", { name: "Show the New design to visitors" }).click();
    await expect(page.getByText(/Saved\. Visitors see the New design/)).toBeVisible();
  });
});

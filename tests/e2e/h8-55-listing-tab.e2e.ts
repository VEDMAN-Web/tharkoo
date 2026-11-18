import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, resetListingLayouts, signInAdminContext, test } from "./helpers";

/** H8.55: the Listing pages tab of the Page builder holds everything the old Listing pages screen had. */

const SHOTS = process.env.H855_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.addStyleTag({ content: ".adm-savebar { position: static !important; }" });
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

const tab = (page: Page, name: string) => page.getByRole("tab", { name });

test.describe("H8.55 Page builder, Listing pages tab", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("the address opens the right tab, the tab changes the address, Back works, and the old Listing pages address leads here with its category", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/page-builder/?tab=listing");
    await expect(tab(page, "Listing pages")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-tk="listing-builder"]')).toBeVisible();
    await page.goto("/admin/page-builder/?tab=post");
    await expect(tab(page, "Post-ad page")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-tk="post-builder"]')).toBeVisible();
    await page.goto("/admin/page-builder/");
    await expect(tab(page, "Home")).toHaveAttribute("aria-selected", "true");
    await tab(page, "Listing pages").click();
    expect(page.url()).toContain("tab=listing");
    await tab(page, "Post-ad page").click();
    expect(page.url()).toContain("tab=post");
    await page.goBack();
    await expect(tab(page, "Listing pages")).toHaveAttribute("aria-selected", "true");
    await page.goBack();
    await expect(tab(page, "Home")).toHaveAttribute("aria-selected", "true");

    await page.goto("/admin/page-builder/?tab=listing");
    const slug = await page.getByLabel("Applies to").locator("option").nth(1).getAttribute("value");
    await page.goto(`/admin/listing-pages/?kind=category&category=${slug}`);
    await expect(page).toHaveURL(new RegExp(`/admin/page-builder/\\?tab=listing&category=${slug}`));
    await expect(page.getByLabel("Applies to")).toHaveValue(slug!);
    await expect(page.locator('[data-tk="listing-header-card"]').getByLabel(/^Heading template/)).toHaveValue("{h1}");
  });

  test("everything is in the tab: pages choice, heading, Google title and description, the layout that starts from what the pages show today, card width, the source of the words and a preview; axe clean and no sideways scroll at 1440 and 390", async ({ page, context, baseURL }) => {
    test.setTimeout(300_000);
    await resetListingLayouts();
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/page-builder/?tab=listing");
      await expect(page.locator('[data-tk="listing-builder"]')).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      for (const title of ["Which pages", "Heading and intro", "Card width", "Which text does this address use?"]) await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
      await expect(page.locator('[data-tk="listing-title-card"]').getByRole("heading", { name: /Page title & description/ })).toBeVisible();
      await expect(page.locator('[data-tk="listing-title-card"]').getByRole("link", { name: "SEO, Page titles" })).toHaveAttribute("href", "/admin/seo/page-titles/");
      await expect(page.locator('[data-tk="listing-title-card"]')).toContainText("/jobs/");
      await expect(page.locator('[data-tk="listing-title-card"]')).not.toContainText("/{category}/");
      await expect(page.getByRole("button", { name: "Save card width" })).toHaveCount(0);
      await expect(page.locator('[data-tk="listing-header-card"]').getByRole("button")).toHaveCount(0);
      const layout = page.locator('[data-tk="listing-layout"]');
      await expect(layout.getByRole("button", { name: /^Delete Popular searches/ })).toBeEnabled();
      await expect(layout.getByRole("button", { name: /^Delete Page heading/ })).toBeDisabled();
      await expect(layout.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
      await expect(layout.getByText("Not published yet")).toBeVisible();
      await expect(layout.getByText("No blocks yet")).toHaveCount(0);
      expect(await layout.locator("ul[aria-label='Blocks on this page'] > li").count()).toBeGreaterThanOrEqual(4);
      await expect(layout.getByText("Page heading").first()).toBeVisible();
      await expect(layout.getByText("Ads", { exact: true }).first()).toBeVisible();
      if (size.width > 1279) {
        await expect(page.locator('[data-tk="listing-preview"] iframe')).toBeVisible();
        await expect(page.locator('[data-tk="listing-preview"]')).toContainText("The live page");
      } else {
        await expect(page.locator('[data-tk="listing-preview"]')).toBeHidden();
      }
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "listing-tab");
    }
  });

  test("one save bar saves the heading and intro, the layout and the card width together", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/page-builder/?tab=listing");
    const bar = page.getByRole("region", { name: "Save changes" });
    await expect(bar.getByText("All changes saved")).toBeVisible();
    await page.getByLabel(/^Heading template/).fill("H855 {h1}");
    await expect(bar.getByText("Unsaved changes")).toBeVisible();
    await bar.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved. Visitors do not see it until you publish.")).toBeVisible();
    await expect(bar.getByText("All changes saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/^Heading template/)).toHaveValue("H855 {h1}");
    await page.getByRole("radio", { name: /^Narrow/ }).check();
    await expect(bar.getByText("Unsaved changes")).toBeVisible();
    await bar.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("dialog", { name: "Publish" }).getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText(/Published as version \d+/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("radio", { name: /^Narrow/ })).toBeChecked();
    await page.getByLabel(/^Heading template/).fill("{h1}");
    await page.getByRole("radio", { name: /^Medium/ }).check();
    await bar.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("dialog", { name: "Publish" }).getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText(/Published as version \d+/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("radio", { name: /^Medium/ })).toBeChecked();
  });

  test("the Google title and description are written in the tab and appear in SEO, Page titles; an exact address has its own layout and title", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/page-builder/?tab=listing");
    const slug = await page.getByLabel("Applies to").locator("option").nth(2).getAttribute("value");
    await page.getByLabel("Applies to").selectOption(slug!);
    const title = page.locator('[data-tk="listing-title-card"]');
    const stamp = String(Date.now() % 100000);
    await title.getByRole("textbox", { name: /^Page title/ }).fill(`H855 title ${stamp} | {category}`);
    await title.getByRole("textbox", { name: /^Page description/ }).fill(`H855 description ${stamp} for {category}.`);
    await title.getByRole("button", { name: "Save Google title and description" }).click();
    await expect(title.getByText("Saved. The page now uses this title and description.")).toBeVisible();
    await page.goto("/admin/seo/page-titles/");
    await expect(page.locator('[data-tk="titles-listing-link"]').getByRole("link", { name: /Page builder, Listing pages tab/ })).toHaveAttribute("href", "/admin/page-builder/?tab=listing");
    await expect(page.getByText(`H855 title ${stamp}`).first()).toBeVisible();

    await page.goto("/admin/page-builder/?tab=listing");
    await page.getByLabel("Applies to").selectOption("__url");
    await page.getByLabel("Address").first().fill("/h855-exact/");
    await expect(page.locator('[data-tk="listing-layout"]').getByText("Not published yet")).toBeVisible();
    await expect(page.locator('[data-tk="listing-title-card"]')).toContainText("this one address");
    await page.getByLabel("Address").first().fill("not an address");
    await expect(page.getByText("Type a page address such as /property/surat/.").first()).toBeVisible();
  });
});

import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H6.9: the hero's full-banner layout, edited in the home page editor and seen on the public home page. */

const POLL = { timeout: 90_000, intervals: [3_000] };
const SHOTS = join(process.cwd(), ".shots", "H6.9");
const WIDTHS = [390, 768, 1440];

function heroBlock(page: Page) {
  return page.locator("li.lay-block").filter({ has: page.locator(".lay-type", { hasText: /^hero$/ }) });
}

/** Sets a switch to the wanted state, clicking only when it differs. */
async function setSwitch(control: Locator, on: boolean) {
  const checked = (await control.getAttribute("aria-checked")) === "true";
  if (checked !== on) await control.click();
}

async function publish(page: Page, note: string) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Publish" });
  await dialog.getByLabel("Note (optional)").fill(note);
  await dialog.getByRole("button", { name: "Publish now" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("H6.9 hero banner", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
  });

  test("full banner with no text: edge to edge at 390, 768 and 1440, no dark layer, then restored", async ({ page, request }, testInfo) => {
    // The editor and the public page run once, at desktop width; the test sets its own viewports.
    test.skip(testInfo.project.name !== "desktop-1440", "runs once, at desktop width");
    test.setTimeout(300_000);
    mkdirSync(SHOTS, { recursive: true });

    // Set the hero to a full banner with no text or search, and a link on the whole banner.
    await page.goto("/admin/homepage/");
    await expect(page.locator("li.lay-block").first()).toBeVisible();
    const hero = heroBlock(page);
    await hero.getByRole("button", { name: "Edit", exact: true }).click();
    await hero.getByLabel("Layout").selectOption("full");
    await setSwitch(hero.getByRole("switch", { name: "Show heading" }), false);
    await setSwitch(hero.getByRole("switch", { name: "Show sub-heading" }), false);
    await setSwitch(hero.getByRole("switch", { name: "Show search box" }), false);
    const bannerLink = hero.locator("fieldset", { hasText: "Whole-banner link" });
    await bannerLink.getByLabel("Link text").fill("Browse all categories");
    await bannerLink.getByLabel("Address").fill("/categories/");

    // The editor preview shows the same layout in its phone frame.
    const phoneHero = hero.frameLocator('iframe[title="Phone preview"]').locator('section[data-tk="hero"]');
    await expect(phoneHero).toHaveAttribute("data-layout", "full", POLL);
    await expect(phoneHero).toHaveAttribute("data-overlay", "none");

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("All changes saved")).toBeVisible();
    await publish(page, "e2e full banner");

    // The full banner is the default now, so wait for what this publish changes: the banner link (no text or search).
    await expect
      .poll(async () => (await (await request.get("/")).text()).includes("tk-hero-link"), POLL)
      .toBe(true);

    // The public page at each width.
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto("/");
      const section = page.locator('section[data-tk="hero"]');
      await expect(section).toHaveAttribute("data-layout", "full");
      await expect(section).toHaveAttribute("data-overlay", "none");

      const box = await section.boundingBox();
      expect(box, `hero box at ${width}`).not.toBeNull();
      expect(Math.abs(box!.x), `hero starts at the left edge at ${width}`).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.width - width), `hero is full width at ${width}`).toBeLessThanOrEqual(1);
      expect(box!.height, `hero has height at ${width}`).toBeGreaterThan(120);

      // The photo covers the whole banner (cover, no gap at the edges).
      const photo = section.locator("img.tk-hero-photo").first();
      await expect(photo).toBeVisible();
      const photoBox = await photo.boundingBox();
      expect(photoBox!.width, `photo spans the banner at ${width}`).toBeGreaterThanOrEqual(box!.width - 1);
      expect(photoBox!.height, `photo spans the banner height at ${width}`).toBeGreaterThanOrEqual(box!.height - 1);

      // No text, no search, no dark gradient: the only control is the whole-banner link.
      await expect(page.locator(".tk-hero-search")).toHaveCount(0);
      // The heading stays in the page for search engines but is not shown.
      const heading = page.locator("h1.sr-only");
      await expect(heading).toHaveCount(1);
      const headingBox = await heading.boundingBox();
      expect(headingBox!.width, `heading is visually hidden at ${width}`).toBeLessThanOrEqual(1);
      expect(headingBox!.height, `heading is visually hidden at ${width}`).toBeLessThanOrEqual(1);
      const layer = await section.evaluate((node) => getComputedStyle(node, "::after").display);
      expect(layer, `no dark layer at ${width}`).toBe("none");
      const link = section.locator("a.tk-hero-link");
      await expect(link).toHaveAttribute("href", "/categories/");
      await expect(link).toHaveAttribute("aria-label", "Browse all categories");

      expect(await hasHorizontalScroll(page), `no horizontal scroll at ${width}`).toBe(false);
      await page.screenshot({ path: join(SHOTS, `home-full-banner-${width}.png`) });
    }

    // Accessibility: no serious or critical findings on the home page with the full banner.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = result.violations
      .filter((item) => item.impact === "serious" || item.impact === "critical")
      .map((item) => `${item.id} (${item.impact}) x${item.nodes.length}: ${item.nodes[0]?.target.join(" ")}`);
    expect(serious).toEqual([]);

    // Restore: split hero, text and search back on, no banner link. Then publish.
    await page.goto("/admin/homepage/");
    await expect(page.locator("li.lay-block").first()).toBeVisible();
    const editHero = heroBlock(page);
    await editHero.getByRole("button", { name: "Edit", exact: true }).click();
    // Back to the default (the full banner since H6.13), with the text and search on and no banner link.
    await editHero.getByLabel("Layout").selectOption("full");
    await setSwitch(editHero.getByRole("switch", { name: "Show heading" }), true);
    await setSwitch(editHero.getByRole("switch", { name: "Show sub-heading" }), true);
    await setSwitch(editHero.getByRole("switch", { name: "Show search box" }), true);
    const restoreLink = editHero.locator("fieldset", { hasText: "Whole-banner link" });
    await restoreLink.getByRole("button", { name: /Remove whole-banner link/ }).click();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("All changes saved")).toBeVisible();
    await publish(page, "e2e restore default hero");

    await expect
      .poll(async () => {
        const html = await (await request.get("/")).text();
        return html.includes('data-layout="full"') && !html.includes("tk-hero-link") && html.includes("tk-hero-search");
      }, POLL)
      .toBe(true);

    // The restored hero at desktop width: the default layout with text and search.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator('section[data-tk="hero"]')).toHaveAttribute("data-layout", "full");
    await page.screenshot({ path: join(SHOTS, "home-restored-1440.png") });
  });
});

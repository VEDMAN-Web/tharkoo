import AxeBuilder from "@axe-core/playwright";
import type { Locator } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";

const WIDTHS = [1440, 1024, 768, 390];

async function tops(...items: Locator[]) {
  const boxes = await Promise.all(items.map((item) => item.boundingBox()));
  return boxes.map((box) => Math.round(box!.y));
}

test.describe("H7.68 footer", () => {
  test("links, contact cards and social tiles point at the right places and never at #", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator('[data-tk="footer"]');
    await expect(footer.locator('a[href="#"]')).toHaveCount(0);
    await expect(footer.getByRole("link", { name: /^WhatsApp *[+]91 912345678/ })).toHaveAttribute("href", "https://wa.me/91912345678");
    await expect(footer.getByRole("link", { name: /^Telegram *@tharkoo_support/ })).toHaveAttribute("href", "https://t.me/tharkoo_support");
    await expect(footer.getByRole("link", { name: /^Email *support@tharkoo[.]com/ })).toHaveAttribute("href", "mailto:support@tharkoo.com");
    await expect(footer).not.toContainText("[YOUR");
    await expect(footer.getByRole("link", { name: "Tharkoo on WhatsApp" })).toHaveAttribute("href", "https://wa.me/91912345678");
    await expect(footer.getByRole("link", { name: "Tharkoo on Telegram" })).toHaveAttribute("href", "https://t.me/tharkoo_support");
    for (const name of ["X", "LinkedIn", "Instagram", "Pinterest"]) {
      await expect(footer.getByRole("img", { name: `Tharkoo on ${name}` })).toBeVisible();
      await expect(footer.getByRole("link", { name: `Tharkoo on ${name}` })).toHaveCount(0);
    }
    const quick = footer.getByRole("navigation", { name: "Quick links" });
    await expect(quick.getByRole("link")).toHaveText(["Home", "Browse ads", "Categories", "Cities and areas", "Blog", "Help and support", "Contact"]);
    const top = footer.getByRole("navigation", { name: "Top categories" });
    await expect(top.getByRole("link").last()).toHaveText(/All categories/);
    await expect(footer.getByRole("navigation", { name: "Legal" }).getByRole("link").first()).toHaveText("About us");
    await expect(footer).not.toContainText(/(^|[^a-z])office([^a-z]|$)|address/i);
  });

  test("every footer link and tile is at least 44 px to tap", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator('[data-tk="footer"]');
    await footer.scrollIntoViewIfNeeded();
    const small = await footer.locator("a").evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const box = node.getBoundingClientRect();
          const isPill = node.classList.contains("tkn-legal-pill");
          return { text: node.textContent?.trim() || node.getAttribute("aria-label"), height: box.height + (isPill ? 4 : 0), width: box.width };
        })
        .filter((item) => item.height < 44 || item.width < 44),
    );
    expect(small).toEqual([]);
  });

  test("the layout follows the width: 4 columns, 2 by 2, then brand, two lists and contact", async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const footer = page.locator('[data-tk="footer"]');
      await footer.scrollIntoViewIfNeeded();
      const brand = footer.locator(".tkn-foot-brand");
      const quick = footer.locator(".tkn-foot-quick");
      const top = footer.locator(".tkn-foot-top");
      const touch = footer.locator(".tkn-foot-touch");
      if (width >= 1024) {
        const [a, b, c, d] = await tops(brand, quick, top, touch);
        expect(new Set([a, b, c, d]).size, `one row at ${width}`).toBe(1);
        const links = await quick.getByRole("link").evaluateAll((nodes) => new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().left))).size);
        expect(links, "one single list").toBe(1);
      } else if (width >= 768) {
        const [a, d, b, c] = await tops(brand, touch, quick, top);
        expect(a).toBe(d);
        expect(b).toBe(c);
        expect(b).toBeGreaterThan(a);
      } else {
        const [b, c, a, d] = await tops(quick, top, brand, touch);
        expect(b).toBe(c);
        expect(b).toBeGreaterThan(a);
        expect(d).toBeGreaterThan(b);
      }
      expect(await hasHorizontalScroll(page), `no sideways scroll at ${width}`).toBe(false);
    }
  });

  test("hover fills the legal pill and the social tile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "hover needs a pointer");
    await page.goto("/");
    const footer = page.locator('[data-tk="footer"]');
    await footer.scrollIntoViewIfNeeded();
    const pill = footer.getByRole("link", { name: "Terms" });
    const before = await pill.evaluate((node) => getComputedStyle(node).color);
    await pill.hover();
    await expect.poll(() => pill.evaluate((node) => getComputedStyle(node).color)).toBe("rgb(255, 255, 255)");
    expect(before).not.toBe("rgb(255, 255, 255)");
    const tile = footer.getByRole("link", { name: "Tharkoo on WhatsApp" });
    await tile.hover();
    await expect.poll(() => tile.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(37, 211, 102)");
  });

  test("the footer passes axe with no serious or critical issues", async ({ page }) => {
    await page.goto("/");
    const result = await new AxeBuilder({ page }).include('[data-tk="footer"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  });
});

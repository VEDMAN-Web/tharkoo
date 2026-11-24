import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, firstAdPath, hasHorizontalScroll, loginUi, newApi, registerApi, test, uniqueEmail, USER_PASSWORD } from "./helpers";

/** H10.4: phone polish on listing pages, /cities/, the footer and Post your ad, and the ad page meta description. */

const SHOTS = process.env.H104_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

/** The visible links and controls on the page, with their boxes, that are under 24 px in either direction. */
async function smallTargets(page: Page, scope = "body") {
  return page.locator(scope).evaluate((root) => {
    const found: string[] = [];
    for (const el of root.querySelectorAll("a, button, input:not([type=hidden]), select, [role=checkbox]")) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.tagName === "A" && style.display === "inline") continue;
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.height < 24 || rect.width < 24) found.push(`${el.tagName} "${(el.textContent || (el as HTMLInputElement).name || "").trim().slice(0, 24)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }
    return found;
  });
}

test.describe("H10.4 phone polish", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("a listing page on a phone: text never fades (colour contrast stays up during the reveal), the breadcrumb, filter checkboxes and footer links are big enough", async ({ page }) => {
    test.setTimeout(180_000);
    for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      await page.goto("/dating/", { waitUntil: "domcontentloaded" });
      const early = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      expect(early.violations.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
      const faded = await page.evaluate(() => [...document.querySelectorAll(".tk-rv")].filter((el) => el.querySelector(":scope > p") && getComputedStyle(el).opacity !== "1").length);
      expect(faded).toBe(0);
      await page.waitForTimeout(1200);
      expect(await smallTargets(page, "main")).toEqual([]);
      for (const link of await page.locator("nav[aria-label='Breadcrumb'] a, .tkn-ls-crumbs a").all()) expect((await link.boundingBox())!.height, "breadcrumb link").toBeGreaterThanOrEqual(24);
      const footerLinks = page.locator("footer a");
      expect(await footerLinks.count()).toBeGreaterThan(0);
      for (const link of await footerLinks.all()) {
        if (!(await link.isVisible())) continue;
        expect((await link.boundingBox())!.height, `footer link ${await link.innerText()}`).toBeGreaterThanOrEqual(24);
      }
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "listing");
    }
  });

  test("/cities/: the 1 city and All N cities links and the search box are at least 24 px tall; clean at 1440 and 390", async ({ page }) => {
    test.setTimeout(120_000);
    for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      await page.goto("/cities/");
      const links = page.getByRole("link", { name: /^(1 city|All \d+ cities)/ });
      expect(await links.count()).toBeGreaterThan(0);
      for (const link of await links.all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(24);
      expect(await smallTargets(page, "main")).toEqual([]);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "cities");
    }
  });

  test("Post your ad: the Soon tag is 12 px or more, the checkbox and the Help link are big enough, signed out and signed in", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/u/post-insert/");
    await expect(page.locator(".tk-si-tag")).toBeVisible();
    expect(await page.locator(".tk-si-tag").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12);
    expect(await smallTargets(page, "main")).toEqual([]);
    await shot(page, "post-signed-out");
    const email = uniqueEmail("h104");
    const signup = await newApi(baseURL!);
    await registerApi(signup, baseURL!, email);
    await signup.dispose();
    await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
    // H21.0: the help link lives in the computer rail; on a phone the header credit pill is the tap target to check.
    await expect(page.locator("[data-tk=header-credit-pill]")).toBeVisible();
    const help = (await page.locator("[data-tk=header-credit-pill]").boundingBox())!;
    expect(help.height).toBeGreaterThanOrEqual(24);
    expect(help.width).toBeGreaterThanOrEqual(24);
    expect(await smallTargets(page, "main")).toEqual([]);
    expect(await serious(page)).toEqual([]);
    await shot(page, "post");
  });

  test("an ad page's meta description is 120 to 160 characters and says the ad's title, category and city", async ({ page }) => {
    test.setTimeout(120_000);
    const path = await firstAdPath(page);
    await page.goto(path);
    const content = (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
    expect(content.length).toBeGreaterThanOrEqual(120);
    expect(content.length).toBeLessThanOrEqual(160);
    expect(content).toMatch(/ ads in .+ on Tharkoo\. See photos, chat and verify before you meet\./);
    const title = (await page.locator("h1").first().innerText()).trim();
    expect(content.startsWith(title.slice(0, 20))).toBe(true);
  });
});

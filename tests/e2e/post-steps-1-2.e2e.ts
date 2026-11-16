import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, loginUi, newApi, registerApi, test, uniqueEmail, USER_PASSWORD } from "./helpers";

async function poster(page: Page, baseURL: string, prefix: string) {
  const email = uniqueEmail(prefix);
  const signup = await newApi(baseURL);
  await registerApi(signup, baseURL, email);
  await signup.dispose();
  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  await page.waitForURL(/\/u\/post-insert\//);
}

function onPhone(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function bottomOfNav(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = (await page.locator(".tkp-nav").boundingBox())!;
  return box.y + box.height;
}

async function toDetails(page: Page, category: string) {
  await page.locator(".tkp-tile", { hasText: category }).click();
  await page.locator("[data-tk=go-on]").click();
  await expect(page.locator("[data-tk=step-of]")).toContainText("Step 2 of 5");
}

test.describe("H7.83 post an ad, steps 1 and 2", () => {
  test("step 1 is in the page HTML, with the new title, rail labels and an icon on every tile", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await poster(page, baseURL!, "step1");
    const html = await (await page.request.get("/u/post-insert/")).text();
    expect(html).toContain("tkp-tile");
    expect(html).toContain("Dating");
    await expect(page.locator("[data-tk=step-title]")).toHaveText("What are you posting?");
    await expect(page.locator(".tkp-step-label")).toHaveText(["Category", "Details", "Photos", "Contact", "Review"]);
    const tiles = page.locator(".tkp-tile");
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(11);
    await expect(page.locator(".tkp-tile-mark svg")).toHaveCount(count);
    const wide = page.viewportSize()?.width ?? 1440;
    for (let index = 0; index < count; index += 1) {
      const box = (await tiles.nth(index).boundingBox())!;
      expect(box.height, `tile ${index}`).toBeGreaterThanOrEqual(wide >= 1280 ? 64 : wide >= 1024 ? 72 : 88);
    }
    await expect(page.locator("[data-tk=go-on]")).toBeDisabled();
    await expect(page.getByText("Do you need help")).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("tiles are two across on a phone and three across from 600 px", async ({ page, baseURL }) => {
    await poster(page, baseURL!, "tiles");
    const columns = await page.locator(".tkp-tiles").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    expect(columns).toBe((page.viewportSize()?.width ?? 1440) < 600 ? 2 : 3);
  });

  test("Dating details: placeholders for dating, no price, a numeric age, A to Z cities, no old header", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await poster(page, baseURL!, "dating");
    await toDetails(page, "Dating");
    await expect(page.locator("#title")).toHaveAttribute("placeholder", "Looking for coffee and a walk this weekend");
    await expect(page.locator("#text")).toHaveAttribute("placeholder", "Tell people about yourself and what you are looking for");
    await expect(page.locator("#price")).toHaveCount(0);
    await expect(page.locator("#age")).toHaveAttribute("inputmode", "numeric");
    await expect(page.getByText("About You")).toHaveCount(0);
    await expect(page.getByText("* Required fields")).toHaveCount(0);
    await expect(page.getByText("2 BHK")).toHaveCount(0);
    const names = await page.locator("#city option").evaluateAll((options) => options.slice(1).map((option) => option.textContent || ""));
    expect(names.length).toBeGreaterThan(3);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    await page.locator("#age").fill("17");
    await page.locator("#title").focus();
    await expect(page.locator("#age")).toHaveValue("17");
    await expect(page.locator(".tkp-main [data-tk=field-error]").first()).toBeVisible();
  });

  test("a non-people category still has a price box", async ({ page, baseURL }) => {
    await poster(page, baseURL!, "price");
    await toDetails(page, "Jobs");
    await expect(page.locator("#price")).toBeVisible();
    await expect(page.locator("#price")).toHaveAttribute("inputmode", "numeric");
  });

  test("the live preview is the real ad card and follows each keystroke", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await poster(page, baseURL!, "preview");
    await toDetails(page, "Dating");
    await page.locator("#title").pressSequentially("Coffee walk");
    if (onPhone(page)) await page.locator("[data-tk=open-preview]").click();
    const card = onPhone(page) ? page.locator("[data-tk=preview-sheet]") : page.locator("[data-tk=post-preview]");
    await expect(card.locator("article.tkn-ls-card")).toBeVisible();
    await expect(card.locator(".tkn-ls-title")).toHaveText("Coffee walk");
    await expect(card.locator(".tkn-ls-price")).toHaveCount(0);
  });

  test("the draft saves by itself and shows Saved, and Exit keeps it", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await poster(page, baseURL!, "autosave");
    await toDetails(page, "Dating");
    await page.locator("#city").selectOption({ index: 1 });
    await page.locator("#nickname").fill("Asha");
    await page.locator("#title").fill("Coffee and a walk");
    await page.locator("#text").fill("A friendly weekend walk and a coffee, in the morning.");
    await expect(page.locator("[data-tk=draft-saved]")).toHaveAttribute("data-state", "saved", { timeout: 10_000 });
    await expect(page).toHaveURL(/draft=[a-f0-9]{24}/);
    await page.locator("[data-tk=exit-post]").click();
    await page.waitForURL(/\/u\/account\/ads\//);
    await expect(page.locator('[data-tk="owner-card"]').first()).toBeVisible();
  });

  test("Enter moves to the next field", async ({ page, baseURL }) => {
    await poster(page, baseURL!, "enter");
    await toDetails(page, "Jobs");
    await page.locator("#nickname").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#age, #title").first()).toBeFocused();
  });

  test("phone: sticky bar, tap targets, no field hidden behind the bar, no sideways scroll", async ({ page, baseURL }) => {
    test.skip(!onPhone(page), "phone layout only");
    test.setTimeout(120_000);
    await poster(page, baseURL!, "phone");
    const viewport = page.viewportSize()!;
    await page.locator(".tkp-tile", { hasText: "Dating" }).click();
    const nav = (await page.locator(".tkp-nav").boundingBox())!;
    expect(Math.round(nav.y + nav.height)).toBe(viewport.height);
    for (const selector of ["[data-tk=go-on]", "[data-tk=open-preview]", ".tkp-tile"]) {
      const box = (await page.locator(selector).first().boundingBox())!;
      expect(box.height, selector).toBeGreaterThanOrEqual(44);
    }
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 2 of 5");
    for (const id of ["#city", "#nickname", "#age", "#title", "#text"]) {
      const box = (await page.locator(id).boundingBox())!;
      expect(box.height, id).toBeGreaterThanOrEqual(44);
    }
    await page.locator("#text").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = (await page.locator("#text").boundingBox())!;
    const bar = (await page.locator(".tkp-nav").boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(bar.y + 1);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("phone: the Preview button opens the same card in a sheet and closes again", async ({ page, baseURL }) => {
    test.skip(!onPhone(page), "phone layout only");
    await poster(page, baseURL!, "sheet");
    await toDetails(page, "Dating");
    await page.locator("#title").fill("Sheet check title");
    await page.locator("[data-tk=open-preview]").click();
    const sheet = page.locator("[data-tk=preview-sheet]");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(".tkn-ls-title")).toHaveText("Sheet check title");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });

  test("every common size: no sideways scroll, and on desktop Continue stays in view on steps 1 and 2", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await poster(page, baseURL!, "sizes");
    const sizes: [number, number][] = [[360, 740], [390, 844], [768, 1024], [1366, 768], [1536, 730]];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.goto("/u/post-insert/");
      await page.locator(".tkp-tile", { hasText: "Dating" }).click();
      expect(await overflow(page), `${width} step 1`).toBeLessThanOrEqual(0);
      if (width >= 1024) expect((await bottomOfNav(page)) - height, `${width}x${height} step 1: Continue below the fold`).toBeLessThanOrEqual(1);
      await page.locator("[data-tk=go-on]").click();
      await expect(page.locator("[data-tk=step-of]")).toContainText("Step 2 of 5");
      expect(await overflow(page), `${width} step 2`).toBeLessThanOrEqual(0);
      if (width >= 1024) expect((await bottomOfNav(page)) - height, `${width}x${height} step 2: Continue below the fold`).toBeLessThanOrEqual(1);
    }
  });

  test("steps 1 and 2 pass axe with no serious or critical issue", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await poster(page, baseURL!, "axe12");
    const run = async () => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id);
    expect(await run()).toEqual([]);
    await toDetails(page, "Dating");
    expect(await run()).toEqual([]);
  });
});

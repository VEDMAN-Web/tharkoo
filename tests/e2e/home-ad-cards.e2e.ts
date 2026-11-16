import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, isPhone, test } from "./helpers";

const ROW = '[data-tk="ads-row"]';
const CARD = '[data-tk="home-ad"]';

async function openHome(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const row = page.locator(ROW);
  await row.scrollIntoViewIfNeeded();
  await expect(row.locator(CARD).first()).toBeVisible();
  return row;
}

test.describe("H7.84 home ad cards", () => {
  test("eight cards in one row, no tag, no views, no big button, pills are category and city only", async ({ page }) => {
    const row = await openHome(page);
    await expect(row).toHaveAttribute("aria-label", "Latest ads");
    await expect(row.locator(":scope > li")).toHaveCount(8);
    await expect(row.locator(".tkh-ad-badge")).toHaveCount(0);
    await expect(row.locator(".tkh-ad-views")).toHaveCount(0);
    await expect(row.locator(".tkh-ad-more")).toHaveCount(0);
    const text = (await row.innerText()).toLowerCase();
    expect(text).not.toMatch(/super top|\bstar\b|\bviews?\b|view details/);
    const pills = await row.locator(CARD).evaluateAll((cards) => cards.map((card) => [...card.querySelectorAll(".tkh-ad-body .tkh-pill")].map((pill) => pill.textContent || "")));
    for (const set of pills) {
      expect(set.length).toBeGreaterThanOrEqual(1);
      expect(set.length).toBeLessThanOrEqual(2);
      for (const label of set) expect(label).not.toContain("/");
    }
  });

  test("the title is one line with an ellipsis, 18 px and 600", async ({ page }) => {
    const row = await openHome(page);
    const style = await row.locator(".tkh-ad-title").first().evaluate((node) => {
      const css = getComputedStyle(node);
      return { overflow: css.textOverflow, wrap: css.whiteSpace, size: css.fontSize, weight: css.fontWeight };
    });
    expect(style).toEqual({ overflow: "ellipsis", wrap: "nowrap", size: "18px", weight: "600" });
  });

  test("the heart sits on the photo, top right, 40 px, and fills when saved", async ({ page }) => {
    const row = await openHome(page);
    const card = row.locator(CARD).first();
    const photo = (await card.locator(".tkh-ad-photo").boundingBox())!;
    const heart = card.locator(".tkh-ad-photo .tkh-heart");
    const box = (await heart.boundingBox())!;
    expect(Math.round(box.width)).toBe(40);
    expect(Math.round(box.height)).toBe(40);
    expect(Math.round(photo.x + photo.width - (box.x + box.width))).toBeLessThanOrEqual(14);
    expect(Math.round(box.y - photo.y)).toBeLessThanOrEqual(14);
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "false");
  });

  test("the photo carousel has arrows and dots, and the arrow moves to the next picture", async ({ page }) => {
    const row = await openHome(page);
    const card = row.locator(CARD).filter({ has: page.locator(".tkh-ad-dots") }).first();
    await expect(card).toBeVisible();
    await card.hover();
    const next = card.getByRole("button", { name: "Next photo" });
    await expect(next).toBeVisible();
    const count = card.locator(".tkh-ad-count");
    await expect(count).toHaveText(/^1\//);
    await next.click();
    await expect(count).toHaveText(/^2\//);
    await expect(card.locator(".tkh-ad-dots i.is-on")).toHaveCount(1);
    const photo = (await card.locator(".tkh-ad-photo").boundingBox())!;
    expect(Math.round((photo.height / photo.width) * 100)).toBe(125);
    const position = await card.locator(".tkh-ad-slide img").first().evaluate((node) => getComputedStyle(node).objectPosition);
    expect(position).toBe("50% 18%");
  });

  test("a click on the card (not the heart, arrows or pills) opens the ad", async ({ page }) => {
    const row = await openHome(page);
    const card = row.locator(CARD).first();
    const href = await card.locator(".tkh-ad-title a").getAttribute("href");
    await card.locator(".tkh-ad-title").click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test("the section arrows scroll the row by the visible cards and disable at the ends", async ({ page }) => {
    const row = await openHome(page);
    const prev = page.getByRole("button", { name: "Previous ads" });
    const next = page.getByRole("button", { name: "Next ads" });
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();
    const size = (await next.boundingBox())!;
    expect(Math.round(size.width)).toBe(44);
    expect(Math.round(size.height)).toBe(44);
    const before = await row.evaluate((node) => node.scrollLeft);
    await next.click();
    await expect.poll(() => row.evaluate((node) => node.scrollLeft)).toBeGreaterThan(before + 100);
    await expect(prev).toBeEnabled();
    for (let i = 0; i < 6; i += 1) {
      if (await next.isDisabled()) break;
      await next.click();
      await page.waitForTimeout(500);
    }
    await expect(next).toBeDisabled();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the row shows the right number of cards at this width and snaps", async ({ page }, testInfo) => {
    const row = await openHome(page);
    const widths = await row.evaluate((node) => ({
      row: node.clientWidth - 8,
      card: (node.firstElementChild as HTMLElement).getBoundingClientRect().width,
      snap: getComputedStyle(node).scrollSnapType,
    }));
    expect(widths.snap).toContain("mandatory");
    const visible = widths.row / widths.card;
    if (testInfo.project.name === "desktop-1440") expect(Math.round(visible)).toBe(4);
    else expect(visible).toBeGreaterThan(1.05);
  });

  test("the hover pop-out shows after a short wait on a mouse, and goes away on leave", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "mouse only");
    const row = await openHome(page);
    const card = row.locator(CARD).first();
    await card.hover();
    const pop = page.locator('[data-tk="home-ad-popout"]');
    await expect(pop).toBeVisible({ timeout: 3000 });
    await expect(pop.getByRole("link", { name: "Chat" })).toBeVisible();
    await expect(pop.getByRole("link", { name: "View ad" })).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(pop).toHaveCount(0);
  });

  test("a touch screen never shows the pop-out", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL });
    await context.addInitScript(() => {
      localStorage.setItem("nl-age", "ok");
      localStorage.setItem("nl-cookies", "necessary");
    });
    const page = await context.newPage();
    const row = await openHome(page);
    await row.locator(CARD).first().hover();
    await page.waitForTimeout(800);
    await expect(page.locator('[data-tk="home-ad-popout"]')).toHaveCount(0);
    await expect(row.locator(CARD).first().getByRole("button", { name: "Next photo" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await context.close();
  });

  test("the ads block passes axe with no serious or critical issues", async ({ page }) => {
    await openHome(page);
    const result = await new AxeBuilder({ page }).include("#home-fresh").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(bad.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    if (isPhone(page)) expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

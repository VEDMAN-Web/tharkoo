import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, firstAdPath, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H6.17: views and clicks on ad cards and on the ad page. Runs at 390 px (phone) and 1440 px (desktop). */

const SHOTS = join(process.cwd(), ".shots", "H6.17");
const FEED = "/dating/bengaluru/";

async function countsOf(request: import("@playwright/test").APIRequestContext, slug: string) {
  const res = await request.get(`/api/views/counts/?slugs=${encodeURIComponent(slug)}`);
  const body = (await res.json()) as { data: { items: Record<string, { views: number; clicks: number }> } };
  return body.data.items[slug] ?? { views: 0, clicks: 0 };
}

function slugOf(adPath: string) {
  return adPath.replace(/^\/ad\//, "").replace(/\/$/, "");
}

test.describe("H6.17 views and clicks", () => {
  test("each card shows its views and clicks in the bottom right corner, with no sideways scroll", async ({ page }, testInfo) => {
    mkdirSync(SHOTS, { recursive: true });
    await page.goto(FEED);
    const card = page.locator("[data-tk=card]").first();
    await card.waitFor({ state: "attached" });
    await card.scrollIntoViewIfNeeded();
    const label = card.locator('[data-tk="ad-counts"]');
    await expect(label).toBeVisible({ timeout: 15_000 });
    await expect(label.locator('[data-tk="ad-views"]')).toContainText("views");
    await expect(label.locator('[data-tk="ad-clicks"]')).toContainText("clicks");
    await expect(label.locator('[data-tk="ad-views"]')).toHaveCSS("font-size", "12px");

    // Inside the card, in its bottom right corner.
    const cardBox = await card.boundingBox();
    const labelBox = await label.boundingBox();
    expect(cardBox && labelBox).toBeTruthy();
    expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
    expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 1);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await card.screenshot({ path: join(SHOTS, `card-counts-${testInfo.project.name}.png`) });
  });

  test("the counts arrive after the cards are drawn, so the card does not change size", async ({ page }) => {
    await page.goto(FEED);
    const card = page.locator("[data-tk=card]").first();
    await card.waitFor({ state: "attached" });
    await card.scrollIntoViewIfNeeded();
    const before = await card.boundingBox();
    await expect(card.locator('[data-tk="ad-counts"]')).toBeVisible({ timeout: 15_000 });
    const after = await card.boundingBox();
    expect(after!.height).toBeCloseTo(before!.height, 0);
    expect(after!.width).toBeCloseTo(before!.width, 0);
  });

  test("opening an ad counts one view per visitor: opening it again does not add another", async ({ page, request }) => {
    const adPath = await firstAdPath(page, FEED);
    const slug = slugOf(adPath);
    const start = (await countsOf(request, slug)).views;

    await page.goto(adPath);
    await expect.poll(async () => (await countsOf(request, slug)).views, { timeout: 40_000 }).toBe(start + 1);

    // Open it again, twice. Still one view from this visitor.
    await page.goto(adPath);
    await page.waitForLoadState("networkidle");
    await page.goto(adPath);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2_000);
    expect((await countsOf(request, slug)).views).toBe(start + 1);
  });

  test("a click on a card counts once, however often the same visitor clicks it", async ({ page, request }) => {
    const adPath = await firstAdPath(page, FEED);
    const slug = slugOf(adPath);
    const start = (await countsOf(request, slug)).clicks;

    await page.goto(FEED);
    const link = page.locator(`a.tk-card-link[href="${adPath}"]`).first();
    await link.waitFor({ state: "attached" });
    await link.click();
    await page.waitForURL(`**${adPath}`);
    await expect.poll(async () => (await countsOf(request, slug)).clicks, { timeout: 40_000 }).toBe(start + 1);

    await page.goBack();
    await page.waitForURL(`**${FEED}`);
    const again = page.locator(`a.tk-card-link[href="${adPath}"]`).first();
    await again.waitFor({ state: "attached" });
    await again.click();
    await page.waitForURL(`**${adPath}`);
    await page.waitForTimeout(2_000);
    expect((await countsOf(request, slug)).clicks).toBe(start + 1);
  });

  test("an admin sets the shown views and clicks, and the set number is what visitors see", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin form runs once, at desktop width");
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/ads/");
    const hrefs = await page.locator('a[href^="/admin/ads/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    const adHref = hrefs.find((href) => /^\/admin\/ads\/[a-f0-9]{24}\/$/.test(href));
    expect(adHref, "an ad row links to its Views and clicks form").toBeTruthy();

    await page.goto(adHref!);
    await expect(page.getByRole("heading", { name: "Views and clicks", level: 2 })).toBeVisible();
    await expect(page.locator('[data-tk="real-counts"]')).toContainText("Real views so far");
    await page.locator("#shown-views").fill("1234");
    await page.locator("#shown-clicks").fill("56");
    await page.getByRole("button", { name: "Save views and clicks" }).click();
    await expect(page.getByText(/^Saved\. Visitors see/)).toBeVisible();
    await expect(page.locator("#shown-views")).toHaveValue("1234");
    await expect(page.locator("#shown-clicks")).toHaveValue("56");

    const slug = slugOf((await page.getByRole("link", { name: "Open the ad" }).getAttribute("href")) ?? "");
    const request = page.request;
    await expect.poll(async () => (await countsOf(request, slug)).views, { timeout: 40_000 }).toBeGreaterThanOrEqual(1234);
    expect((await countsOf(request, slug)).clicks).toBeGreaterThanOrEqual(56);
  });
});

import { expect, firstAdPath, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H6.17: views and clicks on ad cards and on the ad page. Runs at 390 px (phone) and 1440 px (desktop). */

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
  test("no card and no ad page shows views or clicks to a visitor", async ({ page }) => {
    await page.goto(FEED);
    const card = page.locator(":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])").first();
    await card.waitFor({ state: "attached" });
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1_500);
    await expect(page.locator('[data-tk="ad-counts"]')).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    const adPath = await firstAdPath(page, FEED);
    const start = (await countsOf(page.request, slugOf(adPath))).views;
    await page.goto(adPath);
    await page.waitForTimeout(1_500);
    await expect(page.locator('[data-tk="ad-counts"]')).toHaveCount(0);
    await expect.poll(async () => (await countsOf(page.request, slugOf(adPath))).views, { timeout: 40_000 }).toBeGreaterThan(start);
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
    const link = page.locator(`a.tkh-ad-link[href="${adPath}"]`).first();
    await link.waitFor({ state: "attached" });
    await link.click({ force: true });
    await page.waitForURL(`**${adPath}`);
    await expect.poll(async () => (await countsOf(request, slug)).clicks, { timeout: 40_000 }).toBe(start + 1);

    await page.goBack();
    await page.waitForURL(`**${FEED}`);
    const again = page.locator(`a.tkh-ad-link[href="${adPath}"]`).first();
    await again.waitFor({ state: "attached" });
    await again.click({ force: true });
    await page.waitForURL(`**${adPath}`);
    await page.waitForTimeout(2_000);
    expect((await countsOf(request, slug)).clicks).toBe(start + 1);
  });

  test("an admin sets the shown views and clicks, and the counts feed returns the set number", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin form runs once, at desktop width");
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/ads/");
    const hrefs = await page.locator('a[href^="/admin/ads/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    const candidates = hrefs.filter((href) => /^\/admin\/ads\/[a-f0-9]{24}\/$/.test(href));
    expect(candidates.length, "an ad row links to its Views and clicks form").toBeGreaterThan(0);
    let found = false;
    for (const href of candidates.slice(0, 20)) {
      await page.goto(href);
      if ((await page.getByRole("link", { name: "Open the ad" }).count()) > 0) {
        found = true;
        break;
      }
    }
    expect(found, "a published ad has an Open the ad link").toBe(true);
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

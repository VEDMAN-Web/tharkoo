import { expect, hasHorizontalScroll, isPhone, realAdPath, setSellerAvailable, slugFromAdPath, test } from "./helpers";

const FEED = "/dating/bengaluru/";

test.describe("1 Visitor", () => {
  test("home to category to city feed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    const cards = page.locator(".tkh-cats > li");
    await expect(cards).toHaveCount(4);
    await cards.filter({ hasText: "Dating" }).first().locator("a").click();
    await expect(page).toHaveURL(/\/dating\/$/);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.locator(":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])").count()).toBeGreaterThan(3);
    // city page, reached through the city links on the page or the URL
    await page.goto(FEED);
    await expect(page.locator("h1")).toContainText(/bengaluru/i);
    expect(await page.locator(":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])").count()).toBeGreaterThan(3);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("filters: a category filter applies and clears (H19.1: no Verified or With photos buttons)", async ({ page }) => {
    await page.goto(FEED);
    const all = await page.locator(":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])").count();
    const aside = page.locator(".tkn-ls-aside");
    if (isPhone(page)) await page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn').click();
    await expect(aside.getByText("Verified", { exact: true })).toHaveCount(0);
    await expect(aside.getByText("With photos", { exact: true })).toHaveCount(0);
    const pick = aside.locator(".tkn-ls-row", { has: page.locator(".tkn-ls-opt") }).first();
    await pick.locator(".tkn-ls-row-btn").click();
    await pick.locator(".tkn-ls-opt").first().click();
    await expect(page).toHaveURL(/f\./);
    const filtered = await page.locator(":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])").count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(all);
  });

  test("page 2", async ({ page, request }) => {
    // The demo seed has at most 25 ads per feed, so a real second page does not exist yet.
    test.fixme(true, "Seed data has no feed with more than one page; add 26+ ads to cover pagination.");
    const res = await request.get("/dating/?page=2");
    expect(res.status()).toBe(200);
    await page.goto("/dating/?page=2");
  });

  test("page beyond the last is a 404", async ({ request }) => {
    const res = await request.get(`${FEED}?page=99`);
    expect(res.status()).toBe(404);
  });

  test("ad page: gallery, lightbox, contact reveal, share, report", async ({ page, request, context }) => {
    // H17.1: a sample ad has no contact buttons to reveal, so this is a real ad.
    const path = await realAdPath(page, FEED);
    // H7.5: calls pause while the seller is Away, so this ad's seller is online for the call below.
    await setSellerAvailable(slugFromAdPath(path), true);
    // The raw HTML carries no phone, WhatsApp or Telegram value.
    const html = await (await request.get(path)).text();
    expect(html).not.toMatch(/\b[6-9]\d{9}\b/);
    const siteHtml = await (await request.get("/")).text();
    const siteLinks = new Set(siteHtml.match(/wa\.me\/\d{6,}/g) ?? []);
    expect((html.match(/wa\.me\/\d{6,}/g) ?? []).filter((link) => !siteLinks.has(link))).toEqual([]);
    expect(html).not.toMatch(/href="tel:/);
    const siteTelegram = new Set(siteHtml.match(/t\.me\/[A-Za-z0-9_]{4,}/g) ?? []);
    expect((html.match(/t\.me\/[A-Za-z0-9_]{4,}/g) ?? []).filter((link) => !siteTelegram.has(link))).toEqual([]);

    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);

    // Gallery and lightbox.
    const gallery = page.locator("[data-tk=gallery]").first();
    await expect(gallery.locator("img").first()).toBeVisible();
    const photos = await gallery.locator("img").count();
    expect(photos).toBeGreaterThan(0);
    // Full screen viewer first, then swipe the photo.
    await gallery.locator("[data-tk=gallery-expand]").click();
    const lightbox = page.locator("[data-tk=gallery-viewer]");
    await expect(lightbox).toBeVisible();
    if ((await gallery.locator("[data-tk=gallery-next]").count()) > 0) {
      await lightbox.getByRole("button", { name: "Next photo" }).click();
      await lightbox.getByRole("button", { name: "Previous photo" }).click();
    }
    await page.keyboard.press("Escape");
    await expect(lightbox).toBeHidden();

    // Swipe: a finger drag to the left moves to the next photo.
    const counter = gallery.locator("[data-tk=gallery-counter]");
    if ((await counter.count()) > 0) {
      await expect(counter).toHaveText(/^1 [/]/);
      await gallery.locator(".tkn-gal").evaluate((el) => {
        const touch = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 100 });
        const fire = (type: string, x: number) =>
          el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === "touchend" ? [] : [touch(x)], changedTouches: [touch(x)] }));
        fire("touchstart", 300);
        fire("touchend", 100);
      });
      await expect(counter).toHaveText(/^2 [/]/);
    }

    // Contact reveal: only after the click is the number in the page.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    const revealed = page.waitForResponse((r) => r.url().includes("contact-reveal") && r.request().method() === "POST");
    const scope = isPhone(page) ? "[data-tk=bottom-bar]" : "[data-tk=contact-card]";
    await page.locator(scope + " [data-tk=call]").click();
    const res = await revealed;
    expect(res.status()).toBe(200);
    const link = page.locator(scope + " a[data-tk=call]");
    await expect(link).toBeVisible();
    await expect(link).toHaveText(/\d{6,}/);
    expect(await link.getAttribute("href")).toMatch(/^tel:/);

    // Save the ad (the page has no share button any more).
    const save = page.locator("button.tkn-ad-save:visible").first();
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true");

    // Report link carries the ad.
    const report = page.locator("a.tkn-report:visible").first();
    await expect(report).toHaveAttribute("href", /\/submit-report\/\?ad=/);
    await report.click();
    await expect(page).toHaveURL(/\/submit-report\/\?ad=/);
    await expect(page.locator("h1")).toContainText(/report/i);
  });

  test("report form", async ({ page }) => {
    test.fixme(true, "BUG 1 Visitor: /submit-report/ is a placeholder (no form yet), so a report cannot be filed.");
    await page.goto("/submit-report/?ad=x");
    await expect(page.locator("form")).toBeVisible();
  });

  test("ad page of an unknown ad is a 404", async ({ request }) => {
    const res = await request.get("/ad/does-not-exist-e2e/");
    expect(res.status()).toBe(404);
  });
});

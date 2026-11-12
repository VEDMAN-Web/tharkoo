import { expect, firstAdPath, hasHorizontalScroll, isPhone, test } from "./helpers";

const FEED = "/dating/bengaluru/";

test.describe("1 Visitor", () => {
  test("home to category to city feed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    const cards = page.locator("[data-tk=home-card]");
    await expect(cards).toHaveCount(5);
    await cards.filter({ hasText: "Dating" }).first().click();
    await expect(page).toHaveURL(/\/dating\/$/);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.locator("[data-tk=card]").count()).toBeGreaterThan(3);
    // city page, reached through the city links on the page or the URL
    await page.goto(FEED);
    await expect(page.locator("h1")).toContainText(/bengaluru/i);
    expect(await page.locator("[data-tk=card]").count()).toBeGreaterThan(3);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("filters: verified and with photos", async ({ page }) => {
    await page.goto(FEED);
    const all = await page.locator("[data-tk=card]").count();
    await page.locator("[data-tk=filter-chip]", { hasText: "Verified" }).click();
    await expect(page).toHaveURL(/verified=1/);
    await expect(page.locator("[data-tk=filter-chip]", { hasText: "Verified" })).toHaveClass(/is-on/);
    const verified = await page.locator("[data-tk=card]").count();
    expect(verified).toBeGreaterThan(0);
    expect(verified).toBeLessThanOrEqual(all);
    await page.locator("[data-tk=filter-chip]", { hasText: "With photos" }).click();
    await expect(page).toHaveURL(/photos=1/);
    await expect(page).toHaveURL(/verified=1/);
    expect(await page.locator("[data-tk=card]").count()).toBeGreaterThan(0);
    // toggling the chip again removes the filter
    await page.locator("[data-tk=filter-chip]", { hasText: "Verified" }).click();
    await expect(page).not.toHaveURL(/verified=1/);
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
    const path = await firstAdPath(page, FEED);
    // The raw HTML carries no phone, WhatsApp or Telegram value.
    const html = await (await request.get(path)).text();
    expect(html).not.toMatch(/\b[6-9]\d{9}\b/);
    expect(html).not.toMatch(/wa\.me\/\d{6,}/);
    expect(html).not.toMatch(/href="tel:/);
    expect(html).not.toMatch(/t\.me\/[A-Za-z0-9_]{4,}/);

    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);

    // Gallery and lightbox.
    const gallery = page.locator("[data-tk=gallery]").first();
    await expect(gallery.locator("img").first()).toBeVisible();
    const photos = await gallery.locator("img").count();
    expect(photos).toBeGreaterThan(0);
    // Lightbox first, then swipe the strip.
    await gallery.getByRole("button", { name: /^Open photo 1 of/ }).click();
    const lightbox = page.getByRole("dialog", { name: "Photos" });
    await expect(lightbox).toBeVisible();
    await lightbox.getByRole("button", { name: "Next photo" }).click();
    await lightbox.getByRole("button", { name: "Previous photo" }).click();
    await page.keyboard.press("Escape");
    await expect(lightbox).toBeHidden();

    // Swipe: drag the strip left, the active dot moves on.
    const dots = gallery.locator(".tk-strip-dots button");
    if ((await dots.count()) > 1) {
      // A real finger drag; mouse drags get cancelled by the browser's image drag.
      await gallery.locator(".tk-strip-view").evaluate((el) => {
        const fire = (type: string, x: number) =>
          el.dispatchEvent(new PointerEvent(type, { clientX: x, bubbles: true, pointerId: 1, pointerType: "touch" }));
        fire("pointerdown", 300);
        fire("pointermove", 200);
        fire("pointerup", 100);
      });
      await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
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

    // Share: copy link.
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("status").filter({ hasText: /link copied|address bar/i })).toBeVisible();

    // Report link carries the ad.
    const report = page.locator("a.tk-report");
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

import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, expect, hasHorizontalScroll, loginUi, test, withLocalDb } from "./helpers";

/** H17.13: the RTA label. A RATING meta tag in the head of every page and a small text link in the footer, both behind one Settings switch (on by default). */

const RTA = "RTA-5042-1996-1400-1577-RTA";
const META = new RegExp(`<meta name="RATING" content="${RTA}"`);
const SHOTS = process.env.RTA_SHOTS_DIR || "";

async function listingPath(page: Page) {
  await page.goto("/property/");
  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));
  return hrefs.find((href) => /^\/property\/[a-z0-9-]+\/$/.test(href)) ?? "/property/";
}

async function adPath(request: import("@playwright/test").APIRequestContext) {
  const xml = await (await request.get("/sitemap/ads.xml")).text();
  const real = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1] ?? "").pathname)[0];
  if (real) return real;
  const demo = await withLocalDb((db) => db.collection("listings").findOne({ status: "active", slug: { $regex: "^demo-" } }, { projection: { slug: 1 } }));
  return `/ad/${demo?.slug}/`;
}

test.describe("H17.13 RTA label", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await withLocalDb((db) => db.collection("sites").updateMany({}, { $unset: { rtaLabel: "" } }));
  });

  test("ON by default: the meta tag is in the head of the home page, a listing page and an ad page", async ({ request, page }) => {
    for (const path of ["/", await listingPath(page), await adPath(request)]) {
      const html = await (await request.get(path)).text();
      expect(html, path).toMatch(META);
      expect(html.match(/<meta name="RATING"/g)?.length, `${path}: one RATING tag`).toBe(1);
      expect(html, path).not.toMatch(/name="rating" content="adult"/i);
    }
  });

  test("ON: the footer has a small text link to rtalabel.org at 390, 768 and 1440 px", async ({ page }) => {
    for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const badge = page.locator("[data-tk=footer] [data-tk=rta-label]");
      await badge.scrollIntoViewIfNeeded();
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText("RTA · Restricted to adults");
      await expect(badge).toHaveAttribute("href", "https://www.rtalabel.org/");
      await expect(badge).toHaveAttribute("target", "_blank");
      expect(await badge.getAttribute("rel")).toMatch(/noopener/);
      expect(await badge.getAttribute("rel")).toMatch(/nofollow/);
      expect(await badge.locator("img").count(), "no image from rtalabel.org").toBe(0);
      const box = await badge.boundingBox();
      expect(box?.height ?? 0, `${width}px: tap target height`).toBeGreaterThanOrEqual(24);
      expect(box?.width ?? 0, `${width}px: tap target width`).toBeGreaterThanOrEqual(24);
      expect(await badge.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)), `${width}px: text size`).toBeGreaterThanOrEqual(12);
      expect(await hasHorizontalScroll(page), `${width}px: no horizontal scroll`).toBe(false);
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await page.locator("[data-tk=footer]").screenshot({ path: `${SHOTS}/footer-${width}x${height}.png` });
      }
    }
  });

  test("an admin turns it OFF in Settings: no meta tag and no footer link; ON again brings both back", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin/settings/");
    const toggle = page.getByLabel("Show the RTA label");
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByText(/Saved\. The RTA label and the footer link are off/)).toBeVisible();

    for (const path of ["/", await listingPath(page), await adPath(request)]) {
      expect(await (await request.get(path)).text(), `${path}: off`).not.toMatch(/<meta name="RATING"/);
    }
    await page.goto("/");
    await expect(page.locator("[data-tk=footer] [data-tk=rta-label]")).toHaveCount(0);

    await page.goto("/admin/settings/");
    await page.getByLabel("Show the RTA label").click();
    await expect(page.getByText(/Saved\. Pages carry the RTA label/)).toBeVisible();
    expect(await (await request.get("/")).text()).toMatch(META);
    await page.goto("/");
    await expect(page.locator("[data-tk=footer] [data-tk=rta-label]")).toBeVisible();
  });

  test("the label changes nothing about robots: no rating=adult, robots tags as before", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).not.toMatch(/<meta name="rating" content="adult"/i);
    expect((html.match(/<meta name="robots"/g) ?? []).length).toBeLessThanOrEqual(1);
  });
});

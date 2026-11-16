import { mkdirSync } from "node:fs";
import { expect, test } from "./helpers";

const SHOTS = process.env.H7126_SHOTS_DIR || "";
const PAGES = [
  "/",
  "/safety/",
  "/prohibited-items/",
  "/scam-report/",
  "/terms/",
  "/privacy/",
  "/cookies/",
  "/contact/",
  "/how-it-works/",
  "/help/",
  "/blog/",
  "/categories/",
  "/cities/",
  "/cms/about/",
  "/cms/grievance/",
];

test.describe("H7.126 no placeholder text on a public page", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "checks the HTML, not the layout");
  });

  test("no public page carries placeholder text", async ({ page }) => {
    for (const path of PAGES) {
      const response = await page.request.get(path);
      if (response.status() === 404) continue;
      expect(response.status(), path).toBeLessThan(400);
      const html = (await response.text()).toLowerCase();
      expect(html, path).not.toContain("[placeholder");
      expect(html, path).not.toContain("ved to confirm");
    }
  });

  test("the sitemap lists only pages that serve", async ({ page }) => {
    const xml = await (await page.request.get("/sitemap/content.xml")).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
    expect(new Set(locs).size).toBe(locs.length);
    for (const path of locs) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
    }
  });

  test("shots of Safety and Prohibited items", async ({ page }) => {
    test.skip(!SHOTS, "set H7126_SHOTS_DIR to take shots");
    mkdirSync(SHOTS, { recursive: true });
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      for (const [name, path] of [
        ["safety", "/safety/"],
        ["prohibited-items", "/prohibited-items/"],
      ]) {
        await page.goto(path);
        await expect(page.locator("h1")).toHaveCount(1);
        await page.screenshot({ path: `${SHOTS}/${name}-${width}x${height}.png`, fullPage: true });
      }
    }
  });
});

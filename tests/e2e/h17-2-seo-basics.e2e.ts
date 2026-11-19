import { expect, test } from "./helpers";

/** H17.2: the 404 page has one robots meta, and the sitemaps carry only real dates. */

test.describe("H17.2 sitemaps and the 404 page", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "answers are the same at every size");
  });

  test("a page that does not exist answers 404 with exactly one robots meta", async ({ request }) => {
    for (const path of ["/no-such-page-h172/", "/no-such-category/no-such-city/", "/ad/no-such-ad-h172/"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      const html = await response.text();
      expect((html.match(/<meta name="robots"/g) ?? []).length, `${path}: one robots meta`).toBe(1);
      expect(html, path).toContain("noindex");
    }
  });

  test("the content sitemap never shows today's date for a fixed page, and every date given is a real past date", async ({ request }) => {
    const xml = await (await request.get("/sitemap/content.xml")).text();
    const rows = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)].map((match) => ({ loc: match[1], lastmod: match[2] }));
    expect(rows.length).toBeGreaterThan(5);
    for (const fixed of ["/terms/", "/privacy/", "/cookies/", "/contact/"]) {
      const row = rows.find((entry) => entry.loc.endsWith(fixed));
      expect(row, fixed).toBeTruthy();
      expect(row?.lastmod, `${fixed} has no made-up date`).toBeUndefined();
    }
    for (const row of rows) if (row.lastmod) expect(new Date(row.lastmod).getTime(), row.loc).toBeLessThanOrEqual(Date.now());
  });

  test("the ads sitemap lists ads with the date they were last changed", async ({ request }) => {
    const xml = await (await request.get("/sitemap/ads.xml")).text();
    const rows = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row[2] && !Number.isNaN(new Date(row[2]).getTime()))).toBe(true);
  });
});

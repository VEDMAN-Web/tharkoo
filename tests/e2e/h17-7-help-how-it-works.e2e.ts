import AxeBuilder from "@axe-core/playwright";
import { expect, hasHorizontalScroll, test, withLocalDb } from "./helpers";

/**
 * H17.7: the Help hub tiles open real articles (not the hub itself), the article count is the real count, the How it works questions
 * have their answers in the page text (only hidden until opened), and the Help search box has a name.
 */

test.describe("H17.7 Help hub", () => {
  test("every tile opens a real /help/<article>/ page, the count is the real count, and the search box has a name", async ({ page, request }) => {
    const real = await withLocalDb((db) => db.collection("help_articles").countDocuments({ status: "published" }));
    expect(real ?? 0, "the test database has help articles").toBeGreaterThan(0);
    await page.goto("/help/");
    await expect(page.locator("h1")).toHaveText("How can we help?");
    await expect(page.getByText(new RegExp(`Search the ${real} help articles?`))).toBeVisible();
    await expect(page.getByText(/\b50 articles\b/)).toHaveCount(0);
    const tiles = page.locator("a.h714-cat");
    const total = await tiles.count();
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(real ?? 0);
    const hrefs = await tiles.evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));
    for (const href of hrefs) expect(href, "a tile opens an article, not the hub").toMatch(/^\/help\/[a-z0-9-]+\/$/);
    expect(new Set(hrefs).size, "each tile opens a different article").toBe(hrefs.length);
    for (const href of hrefs.slice(0, 3)) expect((await request.get(href)).status(), href).toBe(200);
    const search = page.getByRole("searchbox", { name: "Search help articles" });
    await expect(search).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    const serious = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(serious.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });

  test("How it works: every answer is in the page text, one is open, and a click opens another and closes the first", async ({ page, request }) => {
    const html = await (await request.get("/how-it-works/")).text();
    for (const answer of ["6-digit code", "Tap Video call on an ad", "from the time it goes live", "Our team checks every report"]) {
      expect(html, `the answer "${answer}" is in the page text`).toContain(answer);
    }
    await page.goto("/how-it-works/");
    const open = page.locator('button[aria-expanded="true"]');
    await expect(open).toHaveCount(1);
    await expect(page.getByText("6-digit code")).toBeHidden();
    await expect(page.getByText("Tap Video call on an ad")).toBeHidden();
    await page.getByRole("button", { name: /^Do I need a password\?/ }).click();
    await expect(page.getByText("6-digit code")).toBeVisible();
    await expect(open).toHaveCount(1);
    await page.getByRole("button", { name: /^How does the video call work\?/ }).click();
    await expect(page.getByText("Tap Video call on an ad")).toBeVisible();
    await expect(page.getByText("6-digit code")).toBeHidden();
  });
});

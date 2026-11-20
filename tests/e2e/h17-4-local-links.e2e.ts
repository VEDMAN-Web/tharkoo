import { expect, test, withLocalDb } from "./helpers";

/**
 * H17.4: on a city page "Nearby" lists cities of the SAME state only (Surat: Gujarat), and "Popular searches" lists only real
 * category + city pages that have ads: no made-up phrases like "Property Lesson".
 */

const hrefsOf = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("navigation", { name, exact: true }).locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));

test.describe("H17.4 local links", () => {
  test("Surat's Nearby cities are cities of Gujarat, and Popular searches are real category and city pages", async ({ page }) => {
    await page.goto("/dating/surat/");
    await expect(page.locator("h1")).toHaveCount(1);
    const nearby = await hrefsOf(page, "Nearby");
    expect(nearby.length, "Surat has neighbours in Gujarat").toBeGreaterThan(0);
    const states = await withLocalDb(async (db) => {
      const surat = await db.collection("locations").findOne({ type: "city", slug: "surat" }, { projection: { parentId: 1 } });
      const result: { slug: string; sameState: boolean; exists: boolean }[] = [];
      for (const href of nearby) {
        const slug = href.split("/").filter(Boolean)[1] ?? "";
        const city = await db.collection("locations").findOne({ type: "city", slug }, { projection: { parentId: 1 } });
        result.push({ slug, exists: Boolean(city), sameState: String(city?.parentId) === String(surat?.parentId) });
      }
      return result;
    });
    for (const item of states ?? []) {
      expect(item.exists, `${item.slug} is a city of the site`).toBe(true);
      expect(item.sameState, `${item.slug} is in the same state as Surat`).toBe(true);
    }
    expect(nearby.every((href) => href.startsWith("/dating/")), "Nearby keeps the category").toBe(true);

    const popular = await hrefsOf(page, "Popular searches");
    const text = (await page.getByRole("navigation", { name: "Popular searches", exact: true }).innerText().catch(() => "")).toLowerCase();
    expect(text).not.toMatch(/lesson|in person|video call|individual/);
    for (const href of popular) {
      expect(href, "a category and city page").toMatch(/^\/[a-z0-9-]+\/[a-z0-9-]+\/$/);
      const [categorySlug, citySlug] = href.split("/").filter(Boolean);
      const found = await withLocalDb(async (db) => {
        const category = await db.collection("categories").findOne({ slug: categorySlug }, { projection: { _id: 1 } });
        const city = await db.collection("locations").findOne({ type: "city", slug: citySlug }, { projection: { _id: 1 } });
        return db.collection("listings").countDocuments({ status: "active", categoryId: category?._id, cityId: city?._id });
      });
      expect(found, `${href} has ads`).toBeGreaterThan(0);
    }
  });

  test("a category page and a district page have no tag phrases under Popular searches either", async ({ page }) => {
    for (const path of ["/dating/", "/dating/surat/"]) {
      await page.goto(path);
      const popular = page.getByRole("navigation", { name: "Popular searches", exact: true });
      if ((await popular.count()) === 0) continue;
      const hrefs = await popular.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));
      for (const href of hrefs) expect(href).not.toContain("/tag/");
    }
  });
});

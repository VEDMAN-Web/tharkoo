import { expect, test } from "./helpers";

const BANNED = /\b(sellers?|vendors?|buyers?)\b/i;
const PAGES = ["/", "/categories/", "/cities/", "/countries/", "/help/", "/how-it-works/", "/contact/", "/safety/", "/blog/", "/dating/", "/dating/bengaluru/", "/search/", "/u/login/", "/u/seller-profile/"];

test.describe("H7.99 visitor-facing words", () => {
  test("public pages never say seller, vendor or buyer (admin pages are not scanned)", async ({ page }) => {
    const hits: string[] = [];
    for (const path of PAGES) {
      const res = await page.goto(path);
      if (!res || res.status() >= 400) continue;
      const title = await page.title();
      const description = (await page.locator('meta[name="description"]').getAttribute("content").catch(() => "")) || "";
      const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      for (const [where, text] of [["title", title], ["description", description], ["body", body]] as const) {
        const match = BANNED.exec(text);
        if (match) hits.push(`${path} ${where}: ...${text.slice(Math.max(0, match.index - 30), match.index + 40)}...`);
      }
    }
    expect(hits).toEqual([]);
  });

  test("an ad page and its popups never say seller, vendor or buyer", async ({ page }) => {
    await page.goto("/dating/bengaluru/");
    const href = await page.locator(':is([data-tk=card], [data-tk=home-ad]) a[href*="/ad/"]').first().getAttribute("href");
    await page.goto(href!);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(BANNED.exec(body)?.[0] ?? "").toBe("");
    expect(await page.title()).not.toMatch(BANNED);
  });
});

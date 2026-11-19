import { expect, firstAdPath, test } from "./helpers";

const ADDRESS = /^\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+-[a-z0-9]{5}\/$/;

async function adLinks(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  const links = page.locator("a[data-ad-link]");
  await links.first().waitFor({ state: "attached" });
  return [...new Set(await links.evaluateAll((els) => els.map((el) => el.getAttribute("href") || "")))];
}

test.describe("H16.2 every ad link is the new address", () => {
  for (const path of ["/", "/dating/", "/dating/bengaluru/", "/search/?q=a"]) {
    test(`cards and rows on ${path} link to /<category>/<city>/<title>-<code>/`, async ({ page }) => {
      const hrefs = await adLinks(page, path);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) expect(href).toMatch(ADDRESS);
    });
  }

  test("the related ads, the report link and the page itself use the new address", async ({ page }) => {
    const old = await firstAdPath(page);
    await page.goto(old);
    const here = new URL(page.url()).pathname;
    expect(here).toMatch(ADDRESS);
    const code = /-([a-z0-9]{5})\/$/.exec(here)![1];

    const related = await page.locator("a[data-ad-link]").evaluateAll((els) => els.map((el) => el.getAttribute("href") || ""));
    for (const href of related) expect(href).toMatch(ADDRESS);

    const report = page.locator("a.tkn-report").first();
    await expect(report).toHaveAttribute("href", new RegExp(`\\?ad=${code}$`));
    await report.click();
    await expect(page.getByText(`You are reporting ad ${code}`)).toBeVisible();
  });

  test("a card opens the ad at its own address", async ({ page }) => {
    await page.goto("/dating/bengaluru/");
    const first = page.locator("a[data-ad-link]").first();
    const href = (await first.getAttribute("href")) as string;
    await page.goto(href);
    expect(new URL(page.url()).pathname).toBe(href);
    await expect(page.locator("h1")).toHaveCount(1);
  });
});

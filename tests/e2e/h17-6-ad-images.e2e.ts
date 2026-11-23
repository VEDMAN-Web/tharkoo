import { expect, firstAdPath, test } from "./helpers";

const FEED = "/dating/bengaluru/";
const FIRST_ROW = 4;

test.describe("H17.6 ad images", () => {
  test("every card photo has a name, a size, and only the first row loads at once", async ({ page }) => {
    await page.goto(FEED);
    const cards = page.locator(":is([data-tk=home-ad], [data-tk=listing-row])");
    await expect(cards.first()).toBeAttached();
    const rows = await cards.evaluateAll((nodes) =>
      nodes.map((node) =>
        [...node.querySelectorAll(".tkh-ad-slide img")].map((img) => ({
          alt: img.getAttribute("alt") ?? "",
          width: img.getAttribute("width"),
          height: img.getAttribute("height"),
          loading: img.getAttribute("loading"),
        })),
      ),
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((photos, card) => {
      photos.forEach((photo, i) => {
        expect(photo.alt, `card ${card} photo ${i}`).toMatch(/^.+, .+, photo \d+$/);
        expect(photo.alt.endsWith(`photo ${i + 1}`), `card ${card} photo ${i} is numbered in order`).toBe(true);
        expect(Number(photo.width)).toBeGreaterThan(0);
        expect(Number(photo.height)).toBeGreaterThan(0);
        const eager = card < FIRST_ROW && i === 0;
        expect(photo.loading, `card ${card} photo ${i}`).toBe(eager ? "eager" : "lazy");
      });
    });
  });

  test("the ad page photo is named with the title, the place and its number, and has a size", async ({ page }) => {
    const path = await firstAdPath(page, FEED);
    await page.goto(path);
    const title = (await page.locator("h1").first().innerText()).trim();
    const main = page.locator(".tkn-gal-img");
    await expect(main).toHaveCount(1);
    const alt = (await main.getAttribute("alt")) ?? "";
    expect(alt).toMatch(/, photo 1$/);
    expect(alt.startsWith(title)).toBe(true);
    expect(alt.split(", ").length).toBeGreaterThanOrEqual(3);
    await expect(main).toHaveAttribute("width", /^\d+$/);
    await expect(main).toHaveAttribute("height", /^\d+$/);
    const blur = page.locator(".tkn-gal-blur");
    await expect(blur).toHaveAttribute("alt", "");
    await expect(blur).toHaveAttribute("aria-hidden", "true");
  });
});

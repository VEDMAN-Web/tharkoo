import { expect, firstAdPath, setListingExpiry, test, withLocalDb } from "./helpers";

const ADDRESS = /^\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)-([a-z0-9]{5})\/$/;

async function adRow(slug: string) {
  const row = await withLocalDb((db) => db.collection("listings").findOne({ slug }, { projection: { code: 1, title: 1 } }));
  if (!row) throw new Error(`No local ad ${slug}`);
  return row as unknown as { code: string; title: string };
}

async function locationOf(page: import("@playwright/test").Page, path: string) {
  const res = await page.request.get(path, { maxRedirects: 0 });
  return { status: res.status(), to: res.headers().location ? new URL(res.headers().location, "http://x").pathname : "" };
}

test.describe("H16.2 new ad addresses", () => {
  test("the old /ad/<slug>/ link forwards to the new address, which opens with its own canonical", async ({ page }) => {
    const old = await firstAdPath(page);
    const forward = await locationOf(page, old);
    expect([301, 308]).toContain(forward.status);
    expect(forward.to).toMatch(ADDRESS);

    const response = await page.goto(forward.to);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(new URL(page.url()).pathname).toBe(forward.to);
    const canonical = await page.locator("link[rel=canonical]").getAttribute("href");
    expect(new URL(canonical || "", "http://x").pathname).toBe(forward.to);
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
    expect(ld).toContain(forward.to);
  });

  test("a wrong category, city or title part forwards to the right address, and an unknown code is a 404", async ({ page }) => {
    const old = await firstAdPath(page);
    const right = (await locationOf(page, old)).to;
    const [, category, city, , code] = ADDRESS.exec(right) as RegExpExecArray;

    const wrongTitle = await locationOf(page, `/${category}/${city}/not-the-title-${code}/`);
    expect(wrongTitle.to).toBe(right);
    const wrongCategory = await locationOf(page, `/friends/${city}/anything-${code}/`);
    expect(wrongCategory.to).toBe(right);
    const wrongCity = await locationOf(page, `/${category}/pune/anything-${code}/`);
    expect(wrongCity.to).toBe(right);

    const unknown = await page.request.get(`/${category}/${city}/anything-zzzz9/`, { maxRedirects: 0 });
    expect(unknown.status()).toBe(404);
  });

  test("changing the title makes a new address and the old one forwards to it", async ({ page }) => {
    const old = await firstAdPath(page);
    const slug = old.split("/").filter(Boolean).pop() as string;
    const before = (await locationOf(page, old)).to;
    const row = await adRow(slug);
    try {
      await withLocalDb((db) => db.collection("listings").updateOne({ slug }, { $set: { title: "A brand new title for this ad" } }));
      const after = await locationOf(page, before);
      expect(after.status === 301 || after.status === 308).toBe(true);
      expect(after.to).toBe(before.replace(/\/[^/]+-([a-z0-9]{5})\/$/, `/a-brand-new-title-for-this-ad-$1/`));
      const opened = await page.goto(after.to);
      expect(opened?.status()).toBe(200);
      await expect(page.locator("h1")).toContainText("A brand new title for this ad");
    } finally {
      await withLocalDb((db) => db.collection("listings").updateOne({ slug }, { $set: { title: row.title } }));
    }
  });

  test("areas of a city still open as before", async ({ page }) => {
    await page.goto("/dating/bengaluru/");
    const area = page.locator('a[href^="/dating/bengaluru/"]').filter({ hasNot: page.locator("[data-tk=card]") });
    const hrefs = await area.evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute("href") || ""))].filter((href) => /^\/dating\/bengaluru\/[a-z0-9-]+\/$/.test(href)),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs.slice(0, 3)) {
      const res = await page.request.get(href, { maxRedirects: 0 });
      expect([200, 308], href).toContain(res.status());
    }
  });

  test("/ad/video keeps working and an ended ad is gone at its new address", async ({ page }) => {
    const video = await page.request.get("/ad/video/missing.mp4", { maxRedirects: 0 });
    expect(video.status()).toBe(404);

    const old = await firstAdPath(page);
    const slug = old.split("/").filter(Boolean).pop() as string;
    const address = (await locationOf(page, old)).to;
    expect(await setListingExpiry(slug, new Date(Date.now() - 86_400_000))).toBe(true);
    try {
      const gone = await page.request.get(address, { maxRedirects: 0 });
      expect(gone.status()).toBe(410);
    } finally {
      await setListingExpiry(slug, new Date(Date.now() + 30 * 86_400_000));
    }
  });
});

import { mkdirSync } from "node:fs";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { adAddressPattern, expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, test, withLocalDb } from "./helpers";

/** H14.2 part 2: the whole ad card is the link in the user panel (My ads, Saved ads, Analytics rows). */

const SHOTS = process.env.H142B_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function liveAd(api: APIRequestContext, base: string, slug: string, title: string) {
  const categories = (await (await api.get("/api/categories")).json()).data.categories as { _id: string }[];
  const cities = (await (await api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  for (const category of categories) {
    const res = await api.post("/api/listings", {
      headers: originHeaders(base, "/u/post-insert/"),
      data: { categoryId: category._id, cityId: city.id, title, description: "A wooden desk in good condition for the whole family." },
    });
    if (res.status() === 201) {
      const id = ((await res.json()).data as { id: string }).id;
      const { ObjectId } = await import("mongodb");
      await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(id) }, { $set: { status: "active", slug, price: 4500, publishedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) } }));
      return id;
    }
  }
  throw new Error("No category accepted a draft ad");
}

/** Click events the page sends, written down inside the page so they survive the page change. */
async function watchClicks(page: Page) {
  await page.addInitScript(() => {
    const note = (body: unknown) => {
      void (async () => {
        const text = body instanceof Blob ? await body.text() : String(body ?? "");
        const found = (text.match(/"type":"click"/g) ?? []).length;
        if (found) localStorage.setItem("__clicks", String(Number(localStorage.getItem("__clicks") ?? "0") + found));
      })();
    };
    const beacon = navigator.sendBeacon?.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (String(url).includes("/api/views/")) note(data);
      return beacon ? beacon(url, data) : false;
    };
  });
  return async () => Number(await page.evaluate(() => localStorage.getItem("__clicks") ?? "0"));
}

test.describe("H14.2 the whole ad card is the link, in the panel", () => {
  test("My ads: photo, title, status row and empty space open the ad; Edit and Boost do not; Tab then Enter opens it", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const slug = `panel-desk-${Date.now()}`;
    const owner = await newUserApi(baseURL!, "panelowner");
    await liveAd(owner.api, baseURL!, slug, `Panel desk ${Date.now()}`);
    await loginUi(page, owner.email, undefined, "/u/account/ads/");
    const card = page.locator('[data-tk="card"]').first();
    await expect(card).toBeVisible();
    await shot(page, "my-ads");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await card.evaluate((node) => getComputedStyle(node).cursor)).toBe("pointer");
    await expect(page.getByText("View ad", { exact: true })).toHaveCount(0);
    await expect(page.getByText("View my ads", { exact: true })).toHaveCount(0);

    const open = async (where: () => Promise<void>) => {
      await where();
      await expect(page).toHaveURL(await adAddressPattern(slug));
      await page.goBack();
      await expect(card).toBeVisible();
    };
    // A real mouse at the spot: the stretched link is over everything, so Playwright's own click on a covered element would wait for ever.
    const clickMiddle = async (target: Locator) => {
      const box = (await target.boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    await open(() => clickMiddle(card.locator(".tk-card-photo")));
    await open(() => clickMiddle(card.locator(".tk-card-title")));
    await open(async () => {
      const status = (await card.locator(".tkp-owner-status").boundingBox())!;
      await page.mouse.click(status.x + status.width / 2, status.y + status.height / 2);
    });
    await open(async () => {
      const box = (await card.locator(".tk-card-body").boundingBox())!;
      await page.mouse.click(box.x + box.width - 12, box.y + 10);
    });

    // A2: the owner buttons do not open the ad. Edit goes to the editor, Boost opens its own sheet.
    await card.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(/\/u\/post-insert\//);
    await expect(page).not.toHaveURL(/\/ad\//);
    await page.goBack();
    await card.locator("[data-tk=promote-open]").click();
    await expect(page.locator("[data-tk=promote-sheet]")).toBeVisible();
    await expect(page).toHaveURL(/\/u\/account\/ads\//);
    await page.getByRole("button", { name: "Close" }).first().click();

    // A4: Tab until the card's link has focus, the card shows a ring, Enter opens the ad.
    let focused = false;
    for (let step = 0; step < 150 && !focused; step += 1) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => document.activeElement?.classList.contains("tk-card-link") ?? false);
    }
    expect(focused, "Tab reaches the card link").toBe(true);
    const ring = await page.evaluate(() => {
      const style = getComputedStyle((document.activeElement as HTMLElement).closest(".tk-card") as HTMLElement);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);
    await shot(page, "my-ads-focus");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(await adAddressPattern(slug));
    await owner.api.dispose();
  });

  test("Analytics: the whole row opens the ad", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const slug = `panel-stats-${Date.now()}`;
    const owner = await newUserApi(baseURL!, "panelstats");
    await liveAd(owner.api, baseURL!, slug, `Panel stats ${Date.now()}`);
    await loginUi(page, owner.email, undefined, "/u/account/analytics/");
    const row = page.locator('[data-tk="analytics-row"]').first();
    await expect(row).toBeVisible();
    await shot(page, "analytics");
    expect(await hasHorizontalScroll(page)).toBe(false);
    // Any cell of the row: the Views number, far from the title.
    const last = (await row.locator("td").last().boundingBox())!;
    await page.mouse.click(last.x + last.width / 2, last.y + last.height / 2);
    await expect(page).toHaveURL(await adAddressPattern(slug));
    await page.goBack();
    await row.getByRole("link").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(await adAddressPattern(slug));
    await owner.api.dispose();
  });

  test("Saved ads: the whole card opens the ad with one click event", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const clicks = await watchClicks(page);
    const owner = await newUserApi(baseURL!, "panelsaved");
    await loginUi(page, owner.email, undefined, "/");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Save the first ad of Home with its heart, then open the saved list.
    await page.locator('[data-tk="ads-row"] [data-tk="home-ad"] .tkh-heart').first().click();
    await page.goto("/u/account/saved/");
    const card = page.locator('[data-tk="card"]').first();
    await expect(card).toBeVisible();
    await shot(page, "saved");
    expect(await hasHorizontalScroll(page)).toBe(false);
    const body = (await card.locator(".tk-card-body").boundingBox())!;
    await page.mouse.click(body.x + 20, body.y + 20);
    await expect(page).toHaveURL(/-[a-z0-9]{5}\/$/);
    await page.waitForTimeout(400);
    expect(await clicks(), "one click event for opening the saved card").toBe(1);
    await owner.api.dispose();
  });
});

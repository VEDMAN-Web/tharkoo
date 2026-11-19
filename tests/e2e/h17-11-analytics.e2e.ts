import { ObjectId } from "mongodb";
import type { Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, cleanTest as test, expect, loginUi, withLocalDb } from "./helpers";

/**
 * H17.11: Google Analytics. Google is never called: every request to a Google host is answered by a stub here.
 * Nothing loads before Accept, admin pages never load it, and the events carry no personal fields.
 */

const ID = "G-TESTH1711";
const GOOGLE = /(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)/;

async function stubGoogle(page: Page) {
  const hits: string[] = [];
  await page.route(GOOGLE, async (route) => {
    hits.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" });
  });
  return hits;
}

async function openAsAdult(page: Page) {
  // Age confirmed; the cookie choice is left to each test.
  await page.addInitScript(() => localStorage.setItem("nl-age", "ok"));
}

type DataLayerEntry = unknown[];
const dataLayer = (page: Page) => page.evaluate(() => Array.from((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((entry) => Array.from(entry)) as unknown[][]);
const eventsNamed = (layer: DataLayerEntry[], name: string) => layer.filter((entry) => entry[0] === "event" && entry[1] === name);

test.describe("H17.11 Google Analytics", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the same at every size");
  });

  test.describe.configure({ mode: "serial" });

  test("an admin sets the Google Analytics ID in Settings", async ({ page }) => {
    // The real screen, so the saved value, the audit and the public refresh are all used.
    await openAsAdult(page);
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin/settings/");
    const field = page.getByLabel("Measurement ID");
    await expect(field).toBeVisible();
    await field.fill(ID);
    await page.getByRole("button", { name: "Save Google Analytics ID" }).click();
    await expect(page.getByText(/Saved. The tag loads/)).toBeVisible();
  });

  test.afterAll(async () => {
    await withLocalDb((db) => db.collection("sites").updateMany({}, { $unset: { googleAnalyticsId: "" } }));
  });

  test("nothing is requested from Google before Accept, nor after Only necessary", async ({ page }) => {
    const hits = await stubGoogle(page);
    await openAsAdult(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Accept" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(hits, "before any choice").toEqual([]);
    await page.getByRole("button", { name: "Only necessary" }).click();
    await page.goto("/dating/pune/");
    await page.waitForLoadState("networkidle");
    expect(hits, "after Only necessary").toEqual([]);
    expect(await page.evaluate(() => Boolean((window as unknown as { __tkGa?: boolean }).__tkGa))).toBe(false);
  });

  test("after Accept the tag loads with the configured ID, consent starts denied and no ad features are on", async ({ page }) => {
    const hits = await stubGoogle(page);
    await openAsAdult(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Accept" }).click();
    await expect.poll(() => hits.length).toBeGreaterThan(0);
    expect(hits.some((url) => url.includes(`gtag/js?id=${ID}`))).toBe(true);
    await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __tkGa?: boolean }).__tkGa))).toBe(true);
    const layer = await dataLayer(page);
    const consentDefault = layer.find((entry) => entry[0] === "consent" && entry[1] === "default");
    expect(consentDefault?.[2]).toMatchObject({ analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    const config = layer.find((entry) => entry[0] === "config");
    expect(config?.[1]).toBe(ID);
    expect(config?.[2]).toMatchObject({ allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: false });
    const grants = layer.filter((entry) => entry[0] === "consent" && entry[1] === "update");
    for (const grant of grants) expect(JSON.stringify(grant[2])).not.toMatch(/ad_storage":"granted|ad_user_data":"granted|ad_personalization":"granted/);
    // The choice is remembered: a later visit loads the tag without asking again.
    await page.reload();
    await expect(page.getByRole("button", { name: "Accept" })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __tkGa?: boolean }).__tkGa))).toBe(true);
  });

  test("a search sends category and city only, and the page address has no query string", async ({ page }) => {
    await stubGoogle(page);
    await openAsAdult(page);
    await page.addInitScript(() => localStorage.setItem("nl-cookies", "all"));
    await page.goto("/search/?q=rahul+9876543210&category=dating&city=pune");
    await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __tkGa?: boolean }).__tkGa))).toBe(true);
    await expect.poll(async () => eventsNamed(await dataLayer(page), "search").length).toBeGreaterThan(0);
    const layer = await dataLayer(page);
    const search = eventsNamed(layer, "search")[0];
    expect(search?.[2]).toEqual({ category: "dating", city: "pune" });
    const text = JSON.stringify(layer);
    expect(text).not.toContain("rahul");
    expect(text).not.toContain("9876543210");
    const view = eventsNamed(layer, "page_view")[0];
    expect(String((view?.[2] as { page_location?: string })?.page_location)).not.toContain("?");
  });

  test("a real ad sends ad_view and contact_click without personal fields; a sample ad sends neither", async ({ page, request }) => {
    await stubGoogle(page);
    await openAsAdult(page);
    await page.addInitScript(() => localStorage.setItem("nl-cookies", "all"));
    const sampleSlug = await withLocalDb((db) => db.collection("listings").findOne({ status: "active", slug: { $regex: "^demo-" } }, { projection: { slug: 1 } }));
    expect(sampleSlug?.slug).toBeTruthy();
    const real = await withLocalDb(async (db) => {
      const source = await db.collection("listings").findOne({ status: "active", slug: { $regex: "^demo-" } });
      if (!source) throw new Error("no seeded ad");
      const { _id, lastModerationAt, ...rest } = source as Record<string, unknown> & { _id: ObjectId; lastModerationAt?: Date };
      void _id;
      void lastModerationAt;
      const owner = new ObjectId();
      await db.collection("users").insertOne({ _id: owner, email: `h1711-${Date.now()}@example.test`, displayName: "H1711 Seller", status: "active", roles: ["user"], createdAt: new Date() });
      const slug = `h1711-real-${Date.now()}`;
      const now = new Date();
      await db.collection("listings").insertOne({ ...rest, ownerId: owner, title: `Zqh1711 real ${Date.now()}`, slug, status: "active", sample: false, publishedAt: now, createdAt: now, updatedAt: now, expiresAt: new Date(Date.now() + 3 * 86_400_000), contact: { phone: "9000000011", whatsapp: "9000000022" } });
      return slug;
    });
    expect((await request.get(`/ad/${real}/`)).status()).toBe(200);

    await page.goto(`/ad/${real}/`);
    await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __tkGa?: boolean }).__tkGa))).toBe(true);
    await expect.poll(async () => eventsNamed(await dataLayer(page), "ad_view").length).toBeGreaterThan(0);
    const adView = eventsNamed(await dataLayer(page), "ad_view")[0];
    expect(Object.keys((adView?.[2] as object) ?? {}).sort()).toEqual(["category", "city"]);
    await page.locator("[data-tk=contact-card] [data-tk=chat], [data-tk=bottom-bar] [data-tk=chat]").first().click();
    await expect.poll(async () => eventsNamed(await dataLayer(page), "contact_click").length).toBeGreaterThan(0);
    const clicked = eventsNamed(await dataLayer(page), "contact_click")[0];
    expect((clicked?.[2] as { method?: string })?.method).toBe("chat");
    expect(JSON.stringify(await dataLayer(page))).not.toMatch(/9000000011|9000000022|Zqh1711|H1711 Seller/);

    // A sample ad: no ad_view and no contact_click.
    const sample = await page.context().newPage();
    await stubGoogle(sample);
    await sample.goto(`/ad/${sampleSlug?.slug}/`);
    await expect.poll(() => sample.evaluate(() => Boolean((window as unknown as { __tkGa?: boolean }).__tkGa))).toBe(true);
    await sample.locator("[data-tk=contact-card] [data-tk=chat], [data-tk=bottom-bar] [data-tk=chat]").first().click();
    await sample.waitForTimeout(500);
    const layer = await dataLayer(sample);
    expect(eventsNamed(layer, "ad_view")).toHaveLength(0);
    expect(eventsNamed(layer, "contact_click")).toHaveLength(0);
  });

  test("an admin screen never loads the tag, even after Accept", async ({ page }) => {
    const hits = await stubGoogle(page);
    await openAsAdult(page);
    await page.addInitScript(() => localStorage.setItem("nl-cookies", "all"));
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin/");
    await page.goto("/admin/settings/");
    await page.waitForLoadState("networkidle");
    expect(hits).toEqual([]);
    expect(await page.evaluate(() => Boolean((window as unknown as { __tkGa?: boolean; dataLayer?: unknown }).__tkGa || (window as unknown as { dataLayer?: unknown }).dataLayer))).toBe(false);
  });
});

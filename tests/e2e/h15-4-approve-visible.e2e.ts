import type { Page } from "@playwright/test";
import { expect, signInAdminContext, test, withLocalDb } from "./helpers";

/**
 * H15.4: when staff approve, remove or restore an ad, a visitor sees the change at once (no waiting for a page timer).
 * The ad address is asked for by someone who is not signed in, the way a search engine or a shared link does.
 */

const FAST = 10_000;

async function openCreateAd(page: Page) {
  await page.goto("/admin/ads/create/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "1. Who is the ad for" })).toBeVisible();
}

async function createJobAd(page: Page, title: string, publishNow: boolean) {
  await openCreateAd(page);
  const place = page.locator('section[aria-labelledby="ad-place-h"] select');
  await place.nth(0).selectOption({ label: "India" });
  await place.nth(1).selectOption({ label: "Maharashtra" });
  await place.nth(2).selectOption({ label: "Mumbai" });
  await page.getByLabel("Category *").selectOption({ label: "Jobs" });
  await page.getByLabel("Title *").fill(title);
  await page.getByLabel("Description *").fill("A weekday office role with a clear description of the work and the hours.");
  await page.locator("label", { hasText: /^Role/ }).locator("input").first().fill("Office assistant");
  await page.locator("label", { hasText: /^Work mode/ }).locator("select").first().selectOption({ label: "Office" });
  await page.getByRole("radio", { name: publishNow ? "Publish now" : "Send to moderation (default)" }).check();
  await page.getByRole("button", { name: "Create ad" }).click();
  await expect(page.getByText(publishNow ? "The ad is live now." : "The ad is in the moderation queue.")).toBeVisible();
}

const listingByTitle = (title: string) => withLocalDb((db) => db.collection("listings").findOne({ title }, { projection: { slug: 1, status: 1 } }));
const visitorStatus = async (baseURL: string, slug: string) => (await fetch(`${baseURL}/ad/${slug}/`, { cache: "no-store" })).status;

test.describe("H15.4 approve, remove and restore show at once", () => {
  test("an approved ad is public for a visitor within 10 seconds, even if the address was asked for while it was in review", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    const title = `H154 approve ${Date.now()}`;
    await createJobAd(page, title, false);

    await page.goto("/admin/moderation/", { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /Held by rules/ }).click();
    await page.locator('[data-tk="server-table"] tr', { hasText: title }).getByRole("button", { name: "Approve", exact: true }).click();
    await expect.poll(async () => (await listingByTitle(title))?.status, { timeout: 20_000 }).toBe("active");
    const row = await listingByTitle(title);
    expect(row?.slug, "approving gives the ad its address").toBeTruthy();
    await expect.poll(() => visitorStatus(baseURL!, row!.slug as string), { timeout: FAST, intervals: [500] }).toBe(200);
  });

  test("a removed ad is gone for a visitor and a restored one is back, each within 10 seconds", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    const title = `H154 restore ${Date.now()}`;
    await createJobAd(page, title, true);
    const row = await listingByTitle(title);
    expect(await visitorStatus(baseURL!, row!.slug as string), "a live ad is public").toBe(200);

    await page.goto(`/admin/ads/?q=${encodeURIComponent(title)}`, { waitUntil: "networkidle" });
    await page.getByRole("checkbox", { name: `Select ${title}` }).check();
    await page.getByRole("button", { name: "Remove..." }).click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await dialog.getByRole("radio").first().check();
    await dialog.getByRole("button", { name: /^Remove 1 ad/ }).click();
    await expect.poll(async () => (await listingByTitle(title))?.status, { timeout: 20_000 }).toBe("removed");
    await expect.poll(() => visitorStatus(baseURL!, row!.slug as string), { timeout: FAST, intervals: [500] }).not.toBe(200);

    await page.goto("/admin/history/");
    const entry = page.locator('[data-tk="history-screen"] tr, [data-tk="history-screen"] li').filter({ hasText: `Removed: ${title}` }).first();
    await entry.getByRole("button", { name: /Undo|Restore|Put back/ }).first().click();
    await expect.poll(async () => (await listingByTitle(title))?.status, { timeout: 20_000 }).toBe("active");
    await expect.poll(() => visitorStatus(baseURL!, row!.slug as string), { timeout: FAST, intervals: [500] }).toBe(200);
  });
});

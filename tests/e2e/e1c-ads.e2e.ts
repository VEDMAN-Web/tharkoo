import type { Page } from "@playwright/test";
import { expect, signInAdminContext, test, withLocalDb } from "./helpers";
import { expectPageHealthy, watchConsole } from "./e1c-checks";

/** E1-C: the admin ad journeys: post a JOB ad, send ads to moderation and approve or reject them, remove an ad and put it back. */

async function openCreateAd(page: Page) {
  await page.goto("/admin/ads/create/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "1. Who is the ad for" })).toBeVisible();
}

/** Fills the Jobs form (the staff account owns it, Mumbai) and chooses what happens to the ad. */
async function fillJobAd(page: Page, title: string, publishNow: boolean) {
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
}

async function createJobAd(page: Page, title: string, publishNow: boolean) {
  await openCreateAd(page);
  await fillJobAd(page, title, publishNow);
  await page.getByRole("button", { name: "Create ad" }).click();
  await expect(page.getByText(publishNow ? "The ad is live now." : "The ad is in the moderation queue.")).toBeVisible();
}

const listingByTitle = (title: string) => withLocalDb((db) => db.collection("listings").findOne({ title }, { projection: { slug: 1, status: 1 } }));
const publicStatus = async (page: Page, slug: string) => (await page.goto(`/ad/${slug}/`))?.status();
const auditCount = (id: unknown) => withLocalDb((db) => db.collection("audit_events").countDocuments({ targetId: String(id) }));

test.describe("E1-C admin ads", () => {
  test("an admin posts a JOB ad with Publish now and it is live on its public page", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    const errors = watchConsole(page);
    await signInAdminContext(context, baseURL!);
    const title = `E1C admin job ${Date.now()}`;
    await createJobAd(page, title, true);
    await expectPageHealthy(page, "create ad, done");
    const row = await listingByTitle(title);
    expect(row?.status).toBe("active");
    expect(await publicStatus(page, row!.slug as string)).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    await page.goto(`/search/?q=${encodeURIComponent(title)}`);
    await expect(page.getByText(title).first()).toBeVisible();
    expect(errors, "no console errors").toEqual([]);
  });

  test("ads sent to moderation are not public: the queue approves one and rejects the other, with audit entries", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const errors = watchConsole(page);
    await signInAdminContext(context, baseURL!);
    const approved = `E1C approve ${Date.now()}`;
    const rejected = `E1C reject ${Date.now()}`;
    await createJobAd(page, approved, false);
    await createJobAd(page, rejected, false);
    const first = await listingByTitle(approved);
    const second = await listingByTitle(rejected);
    expect(first?.status).toBe("pending");
    await page.goto("/admin/moderation/", { waitUntil: "networkidle" });
    await expectPageHealthy(page, "ads to review");
    await page.getByRole("tab", { name: /Held by rules/ }).click();
    const rowOf = (title: string) => page.locator('[data-tk="server-table"] tr', { hasText: title });
    await expect(rowOf(approved)).toBeVisible();
    await rowOf(approved).getByRole("button", { name: "Approve", exact: true }).click();
    await expect.poll(async () => (await listingByTitle(approved))?.status, { timeout: 20_000 }).toBe("active");

    await page.goto("/admin/moderation/", { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /Held by rules/ }).click();
    await rowOf(rejected).getByRole("button", { name: /^Reject/ }).click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio").first().check();
    await dialog.getByRole("button", { name: /^Reject/ }).click();
    await expect.poll(async () => (await listingByTitle(rejected))?.status, { timeout: 20_000 }).not.toBe("pending");
    expect((await listingByTitle(rejected))?.status).toBe("rejected");
    expect(await publicStatus(page, second!.slug as string), "a rejected ad is not public").not.toBe(200);

    const approvedRow = await withLocalDb((db) => db.collection("listings").findOne({ title: approved }, { projection: { _id: 1 } }));
    const rejectedRow = await withLocalDb((db) => db.collection("listings").findOne({ title: rejected }, { projection: { _id: 1 } }));
    expect(await auditCount(approvedRow!._id), "approving left an audit entry").toBeGreaterThan(0);
    expect(await auditCount(rejectedRow!._id), "rejecting left an audit entry").toBeGreaterThan(0);
    expect(errors, "no console errors").toEqual([]);
  });

  test("an admin removes a live ad from All ads, it comes down, and the history Undo puts it back", async ({ page, context, baseURL }) => {
    test.skip(test.info().project.name === "phone-390", "E1-C6: the row tick boxes are hidden on a phone, so All ads cannot select ads to remove there");
    test.setTimeout(240_000);
    const errors = watchConsole(page);
    await signInAdminContext(context, baseURL!);
    const title = `E1C remove ${Date.now()}`;
    await createJobAd(page, title, true);
    const row = await listingByTitle(title);
    expect(row?.status).toBe("active");
    expect(await publicStatus(page, row!.slug as string)).toBe(200);

    await page.goto("/admin/ads/", { waitUntil: "networkidle" });
    await expectPageHealthy(page, "all ads");
    await page.getByRole("searchbox", { name: "Search ads" }).fill(title);
    await expect(page.locator('[data-tk="ads-screen"] tbody tr')).toHaveCount(1);
    await page.getByRole("checkbox", { name: `Select ${title}` }).check();
    await page.getByRole("button", { name: "Remove..." }).click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio").first().check();
    await dialog.getByRole("button", { name: /^Remove 1 ad/ }).click();
    await expect.poll(async () => (await listingByTitle(title))?.status, { timeout: 20_000 }).toBe("removed");
    expect(await publicStatus(page, row!.slug as string), "a removed ad is not public").not.toBe(200);
    expect(await auditCount(row!._id), "removing left an audit entry").toBeGreaterThan(0);

    await page.goto(`/admin/ads/?tab=removed&q=${encodeURIComponent(title)}`, { waitUntil: "networkidle" });
    await expect(page.locator('[data-tk="ads-screen"] tbody tr', { hasText: title })).toBeVisible();

    await page.goto("/admin/history/");
    const entry = page.locator('[data-tk="history-screen"] tr, [data-tk="history-screen"] li').filter({ hasText: `Removed: ${title}` }).first();
    await expect(entry).toBeVisible();
    await entry.getByRole("button", { name: /Undo|Restore|Put back/ }).first().click();
    await expect.poll(async () => (await listingByTitle(title))?.status, { timeout: 20_000 }).toBe("active");
    expect(errors, "no console errors").toEqual([]);
  });
});

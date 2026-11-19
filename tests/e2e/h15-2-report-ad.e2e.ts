import type { APIRequestContext, Page } from "@playwright/test";
import { expect, firstAdPath, hasHorizontalScroll, newUserApi, originHeaders, signInAdminContext, test, withLocalDb } from "./helpers";

/**
 * H15.2 (E1-A1): "Report this ad" works. The link on the ad page must carry the ad's own address (slug), which is what the report API
 * finds an ad by; before, it carried only the number at the end of the address and the report always answered "That ad could not be found".
 * A hyphenated demo ad and an ad of a real account are both reported, and both reports reach the admin Reports screen.
 */

async function realLiveAd(api: APIRequestContext, base: string, slug: string, title: string) {
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

/** On the ad page: Report this ad, pick a reason, write a note, send. Returns the answer of the report API. */
async function reportFromAdPage(page: Page, adPath: string, note: string) {
  await page.goto(adPath);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /report/i }).first().click();
  await expect(page).toHaveURL(/\/submit-report\/\?ad=/);
  const form = page.getByRole("form", { name: "Report this ad" });
  await form.locator("select").selectOption("fake");
  await form.getByRole("textbox").first().fill(note);
  const sent = page.waitForResponse((res) => res.url().includes("/api/reports") && res.request().method() === "POST");
  await form.getByRole("button", { name: /send|submit/i }).click();
  const answer = await sent;
  await expect(page.getByText("Thank you. Our team reviews every report.")).toBeVisible();
  expect(await hasHorizontalScroll(page)).toBe(false);
  return answer;
}

test.describe("H15.2 report an ad", () => {
  test("a hyphenated demo ad: the report is accepted and reaches the Reports screen", async ({ page }) => {
    test.setTimeout(180_000);
    const adPath = await firstAdPath(page);
    const slug = adPath.replace(/^\/ad\//, "").replace(/\/$/, "");
    expect(slug, "the first seeded ad has a hyphen in its address").toContain("-");
    const note = `H15.2 demo report ${Date.now()}`;
    const answer = await reportFromAdPage(page, adPath, note);
    expect(answer.status()).toBe(200);
    const stored = await withLocalDb(async (db) => {
      const listing = await db.collection("listings").findOne({ slug }, { projection: { _id: 1 } });
      return db.collection("reports").findOne({ listingId: listing!._id, details: note });
    });
    expect(stored, "the report is saved against this ad").toBeTruthy();
    expect(String((stored as { status?: string }).status)).toBe("open");
  });

  test("an ad of a real account: the report is accepted and shows on the admin Reports screen", async ({ page, browser, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    const slug = `h152-real-${Date.now()}`;
    const title = `H152 real desk ${Date.now()}`;
    const owner = await newUserApi(baseURL!, "h152owner");
    const listingId = await realLiveAd(owner.api, baseURL!, slug, title);
    const note = `H15.2 real report ${Date.now()}`;
    const answer = await reportFromAdPage(page, `/ad/${slug}/`, note);
    expect(answer.status()).toBe(200);
    const stored = await withLocalDb((db) => db.collection("reports").findOne({ details: note }));
    expect(stored, "the report is saved").toBeTruthy();
    expect(String((stored as { listingId?: unknown }).listingId)).toBe(listingId);
    await owner.api.dispose();

    // The admin Reports screen lists it (computer width; the admin screens are for a wide screen).
    test.skip(testInfo.project.name !== "desktop-1440", "the admin screens are checked at 1440");
    const staff = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const admin = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await admin.goto("/admin/reports/");
    await expect(admin.locator('[data-tk="reports-screen"]')).toBeVisible();
    await expect(admin.getByText(title).first()).toBeVisible({ timeout: 20_000 });
    await staff.close();
  });
});

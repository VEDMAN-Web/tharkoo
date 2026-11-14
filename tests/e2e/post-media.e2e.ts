import { expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, PNG, test, USER_PASSWORD, withLocalDb } from "./helpers";
import type { APIRequestContext } from "@playwright/test";
import { ObjectId } from "mongodb";

type Ref = { id: string };

/** A draft ad with a category that needs no sub-category, in a real city. */
async function draftAd(api: APIRequestContext, base: string, title: string) {
  const categories = (await (await api.get("/api/categories")).json()).data.categories as { _id: string; name: string }[];
  const cities = (await (await api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  for (const category of categories) {
    const res = await api.post("/api/listings", {
      headers: originHeaders(base, "/u/post-insert/"),
      data: { categoryId: category._id, cityId: city.id, title, description: "A wooden desk in good condition for the whole family." },
    });
    if (res.status() === 201) return ((await res.json()).data as Ref).id;
  }
  throw new Error("No category accepted a draft ad");
}

/** Uploads a photo through the local storage path and returns its media id. */
async function uploadPhoto(api: APIRequestContext, base: string, listingId?: string, kind: "image" | "id_document" = "image") {
  const signed = await api.post("/api/media/sign", {
    headers: originHeaders(base, "/u/post-insert/"),
    data: { ...(listingId ? { listingId } : {}), contentType: "image/png", byteSize: PNG.length, kind },
  });
  expect(signed.status(), await signed.text()).toBe(200);
  const { mediaId, uploadUrl } = (await signed.json()).data as { mediaId: string; uploadUrl: string };
  const saved = await api.post(uploadUrl, {
    headers: originHeaders(base, "/u/post-insert/"),
    multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: PNG }, mediaId },
  });
  expect(saved.status(), await saved.text()).toBe(200);
  return mediaId;
}

test.describe("My photos & videos", () => {
  test("owner sees only their own items, never ID documents, and a live ad keeps its cover", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const base = baseURL!;
    const owner = await newUserApi(base, "media-owner");
    const other = await newUserApi(base, "media-other");
    const title = `Desk ${Date.now()}`;
    const otherTitle = `Chair ${Date.now()}`;

    const adId = await draftAd(owner.api, base, title);
    // Two photos need a promoted ad (a free ad allows one).
    const promoted = await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(adId) }, { $set: { badges: ["featured"] } }));
    expect(promoted?.modifiedCount).toBe(1);
    const cover = await uploadPhoto(owner.api, base, adId);
    const extra = await uploadPhoto(owner.api, base, adId);
    await uploadPhoto(owner.api, base, undefined, "id_document");
    const attached = await owner.api.patch(`/api/listings/${adId}`, {
      headers: originHeaders(base, "/u/post-insert/"),
      data: { stage: "photos", mediaIds: [cover, extra], coverMediaId: cover },
    });
    expect(attached.status(), await attached.text()).toBe(200);
    // Make the ad live for this test (publishing needs ID checks and moderation, which are out of scope here).
    const made = await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(adId) }, { $set: { status: "active" } }));
    expect(made?.modifiedCount).toBe(1);

    const otherAd = await draftAd(other.api, base, otherTitle);
    await uploadPhoto(other.api, base, otherAd);

    await loginUi(page, owner.email, USER_PASSWORD, "/u/account/media/");
    await page.waitForURL(/\/u\/account\/media\//);
    await expect(page.locator("h1")).toContainText(/photos/i);
    const items = page.locator("[data-tk=media-item]");
    await expect(items).toHaveCount(2);
    await expect(page.getByText(otherTitle)).toHaveCount(0);
    await expect(page.locator("[data-kind=image][data-state=live]")).toHaveCount(2);
    expect(await hasHorizontalScroll(page)).toBe(false);

    // Removing the live ad's cover is refused.
    page.once("dialog", (dialog) => void dialog.accept());
    await items.filter({ has: page.locator("[data-tk=media-cover]") }).locator("[data-tk=media-remove]").click();
    await expect(page.locator("[data-tk=media-error]")).toContainText(/keeps its cover photo/i);
    await expect(items).toHaveCount(2);

    // Removing the other photo works and the cover stays.
    page.once("dialog", (dialog) => void dialog.accept());
    await items.filter({ hasNot: page.locator("[data-tk=media-cover]") }).locator("[data-tk=media-remove]").click();
    await expect(items).toHaveCount(1);
    await expect(items.locator("[data-tk=media-cover]")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);

    // Filters: videos are empty for this owner.
    await page.locator("[data-tk=media-filter]", { hasText: "Videos" }).click();
    await expect(page.locator("[data-tk=media-empty]")).toContainText(/videos/i);
  });

  test("the photo step takes several photos, shows a grid with the limit, and makes a cover", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const base = baseURL!;
    const owner = await newUserApi(base, "media-step");
    const adId = await draftAd(owner.api, base, `Step ${Date.now()}`);
    // A promoted draft allows more photos than a free one.
    const promoted = await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(adId) }, { $set: { badges: ["featured"] } }));
    expect(promoted?.modifiedCount).toBe(1);

    await loginUi(page, owner.email, USER_PASSWORD, `/u/post-insert/?draft=${adId}&step=3`);
    await page.waitForURL(/step=3/);
    await expect(page.locator("[data-tk=photo-count]")).toContainText(/0 of \d+ photos/);
    await page.locator("[data-tk=photo-input]").setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: PNG },
      { name: "b.png", mimeType: "image/png", buffer: PNG },
      { name: "c.png", mimeType: "image/png", buffer: PNG },
    ]);
    await expect(page.locator("[data-tk=photo-tile]")).toHaveCount(3, { timeout: 30_000 });
    await expect(page.locator("[data-tk=photo-count]")).toContainText(/3 of \d+ photos/);
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.locator("[data-tk=photo-tile]").nth(1).getByRole("button", { name: "Make cover" }).click();
    await expect(page.locator("[data-tk=photo-tile]").nth(0).locator("[data-tk=photo-cover]")).toHaveCount(1);

    await page.locator("[data-tk=photo-tile]").nth(2).getByRole("button", { name: /Remove/ }).click();
    await expect(page.locator("[data-tk=photo-tile]")).toHaveCount(2);
    await expect(page.locator("[data-tk=photo-count]")).toContainText(/2 of \d+ photos/);
  });
});

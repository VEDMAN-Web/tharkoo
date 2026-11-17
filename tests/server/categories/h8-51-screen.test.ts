import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { detailsOf, detailsProblems, KIND_MISSING, picturesProblems, picturesOf, slugFromName, adsText, tabOf } from "@/app/admin/categories/_screen/model";
import { createCategory, createSubcategory, deleteCategory, updateCategory } from "@/server/categories/manage";
import { loadCategoriesScreen } from "@/server/categories/screen";
import { Category, Listing, SiteMedia } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "", roles: ["admin"] };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["categories", "locations", "listings"]);
});

describe("the Categories & fields screen data (H8.51)", () => {
  it("lists every category in order with its ads, its fields and the Home tile picture, and opens the one the address names", async () => {
    const media = await SiteMedia.create({ url: "/placeholders/buy-and-sell/01.webp", objectKey: "h851-a", alt: "A flat", width: 1200, height: 800, bytes: 1000, contentType: "image/webp", tags: [], uploadedBy: "e2e@example.test" });
    const one = await Category.create({ slug: "alpha", name: "Alpha", kind: "goods", order: 0, enabled: true, fields: [{ key: "a", label: "A", type: "text" }], photo: { mediaId: media._id, focusX: 30, focusY: 40, alt: "A flat" } });
    await Category.create({ slug: "beta", name: "Beta", kind: "service", order: 1, enabled: false, introHtml: "Intro", description: "Beta line", importMaxPhotos: 12 });
    await Listing.create({ ownerId: new Types.ObjectId(), categoryId: one._id, status: "active", title: "A thing", description: "A description that is long enough" });
    const data = await loadCategoriesScreen("beta");
    expect(data.rows.map((row) => [row.slug, row.enabled, row.ads, row.fieldCount, row.thumb])).toEqual([
      ["alpha", true, 1, 1, "/placeholders/buy-and-sell/01.webp"],
      ["beta", false, 0, 0, ""],
    ]);
    expect(data.chosen).toBe(true);
    expect(data.detail).toMatchObject({ slug: "beta", kind: "service", enabled: false, seoIntro: "Intro", homeLine: "Beta line", importMaxPhotos: 12, adCount: 0, subs: [] });
    const first = await loadCategoriesScreen("");
    expect(first.chosen).toBe(false);
    expect(first.detail?.slug).toBe("alpha");
    expect(first.detail?.pictures.photo?.focusX).toBe(30);
    expect((await loadCategoriesScreen("nope")).detail?.slug).toBe("alpha");
  });

  it("an empty site has no detail, and a category with no kind comes through with an empty kind (the screen shows the red note)", async () => {
    expect(await loadCategoriesScreen("x")).toEqual({ rows: [], detail: null, chosen: false });
    await Category.create({ slug: "dating", name: "Dating", order: 0, enabled: true });
    const data = await loadCategoriesScreen("dating");
    expect(data.detail?.kind).toBe("");
    expect(detailsProblems(detailsOf(data.detail!)).kind).toBe(KIND_MISSING);
    expect(KIND_MISSING).toBe("Choose a kind to save.");
  });

  it("the sub-categories of the chosen category come with it, in order", async () => {
    const created = await createCategory(admin, { name: "Cars", kind: "vehicle" });
    await createSubcategory(admin, { categoryId: created.id, name: "Sedans", order: 1 });
    await createSubcategory(admin, { categoryId: created.id, name: "Hatchbacks", order: 0 });
    const data = await loadCategoriesScreen("cars");
    expect(data.detail?.subs.map((row) => row.name)).toEqual(["Hatchbacks", "Sedans"]);
  });
});

describe("saving from the screen (H8.51)", () => {
  it("create gives back the web address, update saves the Home tile line and gives back the address after a rename", async () => {
    const created = await createCategory(admin, { name: "Gadgets", kind: "goods" });
    expect(created.slug).toBe("gadgets");
    const saved = await updateCategory(admin, created.id, { name: "Gadgets and more", slug: "gadgets-and-more", description: "Phones, laptops and more", seoIntro: "An intro", importMaxPhotos: null, enabled: false });
    expect(saved.slug).toBe("gadgets-and-more");
    const row = await Category.findById(created.id).lean();
    expect(row).toMatchObject({ name: "Gadgets and more", slug: "gadgets-and-more", description: "Phones, laptops and more", introHtml: "An intro", enabled: false });
  });

  it("a Home tile line over 160 characters is refused, and a category with no kind cannot be saved", async () => {
    const created = await createCategory(admin, { name: "Gadgets", kind: "goods" });
    await expect(updateCategory(admin, created.id, { description: "x".repeat(161) })).rejects.toThrow(/160/);
    await expect(updateCategory(admin, created.id, { kind: "" })).rejects.toThrow(/kind/i);
  });

  it("removing a category with ads is refused and an empty one goes with its sub-categories", async () => {
    const withAds = await createCategory(admin, { name: "Busy", kind: "goods" });
    await Listing.create({ ownerId: new Types.ObjectId(), categoryId: new Types.ObjectId(withAds.id), status: "active", title: "A thing", description: "A description that is long enough" });
    await expect(deleteCategory(admin, withAds.id)).rejects.toThrow(/Hide it/);
    const empty = await createCategory(admin, { name: "Quiet", kind: "goods" });
    await createSubcategory(admin, { categoryId: empty.id, name: "Sub" });
    await deleteCategory(admin, empty.id);
    expect(await Category.countDocuments({ slug: "quiet" })).toBe(0);
  });

  it("only an admin can save", async () => {
    const created = await createCategory(admin, { name: "Gadgets", kind: "goods" });
    await expect(updateCategory({ email: "", roles: ["moderator"] }, created.id, { name: "x" })).rejects.toThrow(/admin/i);
  });
});

describe("the screen's own rules (H8.51)", () => {
  it("checks the details before a save", () => {
    const base = detailsOf({ name: "Cars", slug: "cars", kind: "vehicle", icon: "", importMaxPhotos: null, seoIntro: "", homeLine: "", enabled: true });
    expect(detailsProblems(base)).toEqual({});
    expect(detailsProblems({ ...base, name: " " }).name).toBeTruthy();
    expect(detailsProblems({ ...base, slug: "" }).slug).toBeTruthy();
    expect(detailsProblems({ ...base, importMaxPhotos: "31" }).importMaxPhotos).toBeTruthy();
    expect(detailsProblems({ ...base, importMaxPhotos: "12" }).importMaxPhotos).toBeUndefined();
    expect(detailsProblems({ ...base, homeLine: "x".repeat(161) }).homeLine).toBeTruthy();
  });

  it("a picture needs a description, and the phone picture needs the wide one", () => {
    const empty = picturesOf({ photo: null, band: null });
    expect(picturesProblems(empty)).toEqual({});
    const image = { assetId: "1", src: "/a.webp", alt: "x", width: 10, height: 10 };
    expect(picturesProblems({ ...empty, photo: { image, alt: "", focusX: 50, focusY: 50 } }).photo).toBeTruthy();
    expect(picturesProblems({ ...empty, photo: { image, alt: "A flat with a balcony", focusX: 50, focusY: 50 } })).toEqual({});
    expect(picturesProblems({ ...empty, phone: image }).phone).toBeTruthy();
  });

  it("small helpers", () => {
    expect(slugFromName("Buy and Sell!")).toBe("buy-and-sell");
    expect(adsText(0)).toBe("No ads");
    expect(adsText(1)).toBe("1 ad");
    expect(adsText(3105)).toBe("3,105 ads");
    expect(tabOf("pictures")).toBe("pictures");
    expect(tabOf("nonsense")).toBe("details");
  });
});

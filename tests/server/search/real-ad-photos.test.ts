import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { listingPhotos } from "@/lib/media";
import { contactChannelsOf } from "@/server/listings/contact-channels";
import { isDemoAd } from "@/server/listings/demo-ads";
import { adPhotoUrl } from "@/server/media/photo-url";
import { Category, Listing, Location, MediaAsset, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { queryListings } from "@/server/search";
import { presentRows } from "@/server/search/query";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const PORTRAIT = /^\/placeholders\/profiles\//;
const CLOUD_KEY = "tharkoo/listings/66aa11bb22cc33dd44ee55ff";

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
  invalidateTags(["site", "categories", "locations", "listings", "feed", "counts"]);
  process.env.CLOUDINARY_CLOUD_NAME = "democloud";
  process.env.CLOUDINARY_API_KEY = "k";
  process.env.CLOUDINARY_API_SECRET = "s";
});
afterEach(() => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
});

async function person(email: string, verificationStatus: "approved" | "unsubmitted" = "unsubmitted") {
  return User.create({
    email,
    displayName: "Owner",
    passwordHash: "x",
    status: "active",
    roles: ["user"],
    dateOfBirth: new Date("1990-01-01"),
    attestedAdultAt: new Date(),
    verificationStatus,
  });
}

async function world() {
  const category = await Category.create({ slug: "dating", name: "Dating", kind: "people", enabled: true, order: 0, fields: [] });
  const state = await Location.create({ type: "state", slug: "maharashtra", name: "Maharashtra", parentId: null, enabled: true, order: 0 });
  const city = await Location.create({ type: "city", slug: "pune", name: "Pune", parentId: state._id, enabled: true, order: 0 });
  const make = (ownerId: string, slug: string, mediaIds: mongoose.Types.ObjectId[] = []) =>
    Listing.create({
      ownerId,
      categoryId: category._id,
      stateId: state._id,
      cityId: city._id,
      title: `Ad ${slug}`,
      slug,
      description: "A description that is long enough",
      status: "active",
      publishedAt: new Date(),
      mediaIds,
      contact: { phone: "9876543210" },
    });
  return { make };
}

async function presented(slug: string, ownerView = false) {
  const row = await Listing.findOne({ slug }).lean();
  const { legacy } = await presentRows([row] as never, new Map(), new Date(), { ownerView });
  return legacy[0];
}

describe("listingPhotos (H7.119)", () => {
  it("gives portraits to a demo people ad with no photo of its own, and nothing to a real one", () => {
    const demo = listingPhotos("dating", "demo-1300", [], true);
    expect(demo).toHaveLength(4);
    expect(demo.every((src) => PORTRAIT.test(src))).toBe(true);
    expect(listingPhotos("dating", "in00012", [])).toEqual([]);
    expect(listingPhotos("dating", "in00012", ["/placeholders/profiles/01.webp"])).toEqual([]);
  });

  it("always prefers a real photo, and leaves other categories as they are", () => {
    expect(listingPhotos("dating", "in00012", ["https://res.cloudinary.com/x/a.jpg"])).toEqual(["https://res.cloudinary.com/x/a.jpg"]);
    expect(listingPhotos("dating", "demo-1300", ["/uploads/a.jpg"], true)).toEqual(["/uploads/a.jpg"]);
    expect(listingPhotos("cars", "in00012", [])).toEqual([]);
    expect(listingPhotos("cars", "demo-1", ["/placeholders/cars/01.webp"], true)).toEqual(["/placeholders/cars/01.webp"]);
  });
});

describe("demo ad rule (H7.119)", () => {
  it("is the seed owner and a demo-numbered slug together", () => {
    expect(isDemoAd(SEED_USER_EMAIL, "demo-0099")).toBe(true);
    expect(isDemoAd("real@example.com", "demo-0099")).toBe(false);
    expect(isDemoAd(SEED_USER_EMAIL, "tharkoo-handmade")).toBe(false);
    expect(isDemoAd(undefined, undefined)).toBe(false);
  });
});

describe("photos on a presented ad (H7.119)", () => {
  it("shows no portraits on a real people ad without a photo, even with a demo-looking slug", async () => {
    const { make } = await world();
    const real = await person("real@example.com");
    await make(real.id, "in00012");
    await make(real.id, "demo-0099");
    expect((await presented("in00012"))?.photos).toEqual([]);
    expect((await presented("demo-0099"))?.photos).toEqual([]);
    const page = await queryListings({ categorySlug: "dating", page: 1, pageSize: 20 });
    expect(page.legacy.flatMap((row) => row.photos ?? [])).toEqual([]);
    expect(page.hits.flatMap((row) => row.photos ?? [])).toEqual([]);
  });

  it("keeps the portraits on a seeded demo ad", async () => {
    const { make } = await world();
    const seed = await person(SEED_USER_EMAIL, "approved");
    await make(seed.id, "demo-0001");
    const shown = (await presented("demo-0001"))?.photos ?? [];
    expect(shown).toHaveLength(4);
    expect(shown.every((src) => PORTRAIT.test(src))).toBe(true);
  });

  it("shows the owner's own cleared Cloudinary photo", async () => {
    const { make } = await world();
    const real = await person("real@example.com");
    const asset = await MediaAsset.create({ ownerId: real._id, kind: "image", objectKey: CLOUD_KEY, status: "cleared" });
    await make(real.id, "in00013", [asset._id]);
    expect((await presented("in00013"))?.photos).toEqual([`https://res.cloudinary.com/democloud/image/upload/c_limit,w_1280,f_auto,q_auto/${CLOUD_KEY}`]);
  });

  it("shows a local upload the same way as before", async () => {
    const { make } = await world();
    const real = await person("real@example.com");
    const asset = await MediaAsset.create({ ownerId: real._id, kind: "image", objectKey: "/uploads/abc.jpg", status: "cleared" });
    await make(real.id, "in00014", [asset._id]);
    expect((await presented("in00014"))?.photos).toEqual(["/uploads/abc.jpg"]);
  });

  it("keeps a photo that is still being checked off public pages, but shows it to its owner", async () => {
    const { make } = await world();
    const real = await person("real@example.com");
    const scanning = await MediaAsset.create({ ownerId: real._id, kind: "image", objectKey: "/uploads/scan.jpg", status: "scanning" });
    await make(real.id, "in00015", [scanning._id]);
    expect((await presented("in00015"))?.photos).toEqual([]);
    expect((await presented("in00015", true))?.photos).toEqual(["/uploads/scan.jpg"]);
  });

  it("never shows a refused, waiting or deleted photo, not even to its owner", async () => {
    const { make } = await world();
    const real = await person("real@example.com");
    const statuses = ["rejected_csam", "rejected_policy", "uploaded", "failed", "deleted"] as const;
    const bad = await Promise.all(statuses.map((status) => MediaAsset.create({ ownerId: real._id, kind: "image", objectKey: `/uploads/${status}.jpg`, status })));
    await make(real.id, "in00016", bad.map((asset) => asset._id));
    expect((await presented("in00016", true))?.photos).toEqual([]);
  });

  it("does not turn an unfinished or private upload key into a link", () => {
    expect(adPhotoUrl("pending")).toBeNull();
    expect(adPhotoUrl("pending-local:66aa")).toBeNull();
    expect(adPhotoUrl("private:id.jpg")).toBeNull();
    expect(adPhotoUrl("tharkoo/id/66aa")).toBeNull();
    expect(adPhotoUrl("tharkoo/listings/../id/66aa")).toBeNull();
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(adPhotoUrl(CLOUD_KEY)).toBeNull();
  });
});

describe("badges on a presented ad (H7.119)", () => {
  it("shows none when the owner verified nothing, and the real ones when they did", async () => {
    const { make } = await world();
    const plain = await person("plain@example.com");
    const checked = await person("checked@example.com", "approved");
    const first = await MediaAsset.create({ ownerId: plain._id, kind: "image", objectKey: "/uploads/p.jpg", status: "cleared" });
    const second = await MediaAsset.create({ ownerId: checked._id, kind: "image", objectKey: "/uploads/q.jpg", status: "cleared" });
    await make(plain.id, "in00020", [first._id]);
    await make(checked.id, "in00021", [second._id]);
    expect((await presented("in00020"))?.trust).toEqual([]);
    expect((await presented("in00021"))?.trust).toEqual(["ID verified", "Age verified", "Photo verified"]);
  });

  it("gives no Photo verified for a verified owner whose ad has no photo", async () => {
    const { make } = await world();
    const checked = await person("checked@example.com", "approved");
    await make(checked.id, "in00022");
    expect((await presented("in00022"))?.trust).toEqual(["ID verified", "Age verified"]);
  });
});

describe("contact channels (H7.119)", () => {
  it("lists only the ways the ad really offers", () => {
    expect(contactChannelsOf({})).toEqual([]);
    expect(contactChannelsOf(null)).toEqual([]);
    expect(contactChannelsOf({ phone: "", whatsapp: "  " })).toEqual([]);
    expect(contactChannelsOf({ phone: "+919876543210" })).toEqual(["phone"]);
    expect(contactChannelsOf({ phone: "+919876543210", whatsapp: "+919876543210" })).toEqual(["phone", "whatsapp"]);
    expect(contactChannelsOf({ whatsapp: "+919876543210" })).toEqual(["whatsapp"]);
  });
});

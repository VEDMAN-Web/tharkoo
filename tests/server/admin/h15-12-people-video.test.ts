import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { filterFor, parseAdsQuery } from "@/server/admin/ads-list";
import { Category, Listing, MediaAsset } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const oid = () => new mongoose.Types.ObjectId();

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
});

async function ad(categoryId: mongoose.Types.ObjectId | undefined, title: string, status: "active" | "removed" = "active") {
  const doc = await Listing.create({ ownerId: oid(), categoryId, title, description: "A description that is long enough", slug: title.toLowerCase().replace(/\W+/g, "-"), status });
  return doc as unknown as { _id: mongoose.Types.ObjectId };
}

async function clip(listingId: mongoose.Types.ObjectId, kind: "video" | "image", status: "cleared" | "uploaded" = "cleared") {
  return MediaAsset.create({ ownerId: oid(), listingId, kind, objectKey: `/uploads/${oid()}.mp4`, status });
}

describe("H15.12 People ads with a video (a read-only All ads filter)", () => {
  it("is off unless the address asks for it", () => {
    expect(parseAdsQuery({})).toMatchObject({ peopleVideo: false });
    expect(parseAdsQuery({ pvideo: "1" })).toMatchObject({ peopleVideo: true });
    expect(parseAdsQuery({ pvideo: "yes" })).toMatchObject({ peopleVideo: false });
  });

  it("finds only people ads that have a video, live or removed, and nothing else", async () => {
    const people = await Category.create({ slug: "dating", name: "Dating", kind: "people", enabled: true, order: 0 });
    const goods = await Category.create({ slug: "bikes", name: "Bikes", kind: "goods", enabled: true, order: 1 });
    const live = await ad(people._id, "People live with video");
    const gone = await ad(people._id, "People removed with video", "removed");
    const photoOnly = await ad(people._id, "People with only a photo");
    const bare = await ad(people._id, "People with nothing");
    const bike = await ad(goods._id, "Bike with video");
    await clip(live._id, "video");
    await clip(gone._id, "video", "uploaded");
    await clip(photoOnly._id, "image");
    await clip(bike._id, "video");
    const found = await Listing.find(await filterFor({ ...parseAdsQuery({ pvideo: "1" }) })).select("title").lean();
    expect(found.map((row) => row.title).sort()).toEqual(["People live with video", "People removed with video"]);
    expect(bare).toBeTruthy();
  });

  it("finds a people ad by its age rule even when the category kind was left empty", async () => {
    const aged = await Category.create({ slug: "meetups", name: "Meetups", enabled: true, order: 0 });
    const row = await ad(aged._id, "Meetup with video");
    await clip(row._id, "video");
    const found = await Listing.find(await filterFor(parseAdsQuery({ pvideo: "1" }))).select("title").lean();
    expect(found.map((item) => item.title)).toEqual(["Meetup with video"]);
  });

  it("changes nothing: every ad keeps its status", async () => {
    const people = await Category.create({ slug: "dating", name: "Dating", kind: "people", enabled: true, order: 0 });
    const row = await ad(people._id, "Stays live");
    await clip(row._id, "video");
    await Listing.find(await filterFor(parseAdsQuery({ pvideo: "1" })));
    expect((await Listing.findById(row._id).lean())?.status).toBe("active");
  });
});

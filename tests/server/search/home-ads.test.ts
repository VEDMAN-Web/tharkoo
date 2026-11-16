import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { composeHomeAds } from "@/lib/home-ads";
import { getHomeAds } from "@/lib/queries";
import { setHomeSelection } from "@/server/listings/home-selection";
import { AuditEvent, Category, Listing, Location } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

function resetDbCache() {
  const g = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (g.mongoose) {
    g.mongoose.conn = null;
    g.mongoose.promise = null;
  }
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  resetDbCache();
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
  resetDbCache();
});
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["site", "categories", "locations", "listings", "feed", "counts"]);
});

const admin = { id: "000000000000000000000001", roles: ["admin"] };

async function seed(count: number) {
  const category = await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0, fields: [], minListingsIndex: 1 });
  const state = await Location.create({ type: "state", slug: "maharashtra", name: "Maharashtra", parentId: null, enabled: true, order: 0 });
  const city = await Location.create({ type: "city", slug: "pune", name: "Pune", parentId: state._id, enabled: true, order: 0 });
  const made = [];
  for (let index = 0; index < count; index += 1) {
    made.push(
      await Listing.create({
        ownerId: new mongoose.Types.ObjectId(),
        categoryId: category._id,
        stateId: state._id,
        cityId: city._id,
        title: `Ad number ${index}`,
        slug: `ad-${index}-aaaa${1000 + index}`,
        description: "A plain ad.",
        status: "active",
        seoNoindex: false,
        publishedAt: new Date(Date.UTC(2026, 5, 1, index)),
      }),
    );
  }
  return made;
}

const ids = (rows: { slug?: string }[]) => rows.map((row) => row.slug);

describe("composeHomeAds", () => {
  it("puts the chosen ads first in the chosen order, fills with the rest, and never repeats", () => {
    const row = (slug: string) => ({ slug });
    const result = composeHomeAds(["b", "a"], [row("a"), row("b")], [row("a"), row("c"), row("b"), row("d")], 3);
    expect(ids(result)).toEqual(["b", "a", "c"]);
  });

  it("ignores a chosen slug that is no longer listed", () => {
    const row = (slug: string) => ({ slug });
    expect(ids(composeHomeAds(["gone", "a"], [row("a")], [row("c")], 8))).toEqual(["a", "c"]);
  });
});

describe("getHomeAds", () => {
  it("returns the 8 newest ads when nothing is chosen", async () => {
    await seed(10);
    const ads = await getHomeAds(8);
    expect(ads).toHaveLength(8);
    expect(ids(ads)[0]).toContain("ad-9-");
    expect(ids(ads)[7]).toContain("ad-2-");
  });

  it("shows the chosen ads first by order, then the newest, 8 in all", async () => {
    const made = await seed(10);
    await setHomeSelection({ listingId: String(made[0]._id), show: true, order: 2, actor: admin, requestId: "r1" });
    await setHomeSelection({ listingId: String(made[3]._id), show: true, order: 1, actor: admin, requestId: "r2" });
    const ads = await getHomeAds(8);
    expect(ads).toHaveLength(8);
    expect(ids(ads).slice(0, 2)).toEqual([made[3].slug, made[0].slug]);
    expect(new Set(ids(ads)).size).toBe(8);
    expect(ids(ads)[2]).toContain("ad-9-");
  });

  it("leaves out a chosen ad that is hidden or not active", async () => {
    const made = await seed(3);
    await setHomeSelection({ listingId: String(made[0]._id), show: true, order: 0, actor: admin, requestId: "r1" });
    await Listing.updateOne({ _id: made[0]._id }, { $set: { feedHidden: true } });
    invalidateTags(["feed", "listings"]);
    expect(ids(await getHomeAds(8))).not.toContain(made[0].slug);
  });
});

describe("setHomeSelection", () => {
  it("is for admins only, checks the order, and writes an audit row", async () => {
    const made = await seed(1);
    const listingId = String(made[0]._id);
    await expect(setHomeSelection({ listingId, show: true, order: 1, actor: { id: admin.id, roles: ["support"] }, requestId: "r" })).rejects.toThrow(/admin/);
    await expect(setHomeSelection({ listingId, show: true, order: -1, actor: admin, requestId: "r" })).rejects.toThrow(/order/);
    await expect(setHomeSelection({ listingId: "nope", show: true, order: 1, actor: admin, requestId: "r" })).rejects.toThrow(/not found/i);
    await setHomeSelection({ listingId, show: true, order: 5, actor: admin, requestId: "r3" });
    const row = await Listing.findById(listingId).lean();
    expect(row?.homeShow).toBe(true);
    expect(row?.homeOrder).toBe(5);
    const events = await AuditEvent.find({ action: "ad.home.update" }).lean();
    expect(events).toHaveLength(1);
  });
});

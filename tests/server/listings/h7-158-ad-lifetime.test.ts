import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_AD_LIFETIME_HOURS } from "@/lib/ads/lifetime-rules";
import { TEXT_DEFAULTS } from "@/lib/ui/text";
import { adLifetimeMs } from "@/server/listings/lifetime";
import { Listing, Site } from "@/server/models";
import { buildFilter } from "@/server/search/query";
import { suggestSearch } from "@/server/search/suggest";
import { defaultShellConfig } from "@/server/site-links/shell-config-rules";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const HOUR = 60 * 60 * 1000;

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

async function ad(title: string, endsInHours: number | null) {
  const doc = await Listing.create({
    ownerId: new mongoose.Types.ObjectId(),
    categoryId: new mongoose.Types.ObjectId(),
    status: "active",
    title,
    description: "A description that is long enough",
    publishedAt: new Date(Date.now() - HOUR),
    ...(endsInHours === null ? {} : { expiresAt: new Date(Date.now() + endsInHours * HOUR) }),
    slug: `ad-${Math.random().toString(36).slice(2, 8)}`,
  });
  return String(doc._id);
}

describe("ads live 48 hours (H7.158)", () => {
  it("the length is the code constant, 48 hours", async () => {
    expect(DEFAULT_AD_LIFETIME_HOURS).toBe(48);
    expect(await adLifetimeMs()).toBe(48 * HOUR);
  });

  it("a stored 72 (the old schema default) or any other stored value is ignored", async () => {
    await Site.collection.insertOne({ key: "default", adLifetimeHours: 72, tags: [] });
    expect(await adLifetimeMs()).toBe(48 * HOUR);
    await Site.collection.updateOne({ key: "default" }, { $set: { adLifetimeHours: 6 } });
    expect(await adLifetimeMs()).toBe(48 * HOUR);
  });

  it("a new site record does not save 72 any more", async () => {
    await Site.create({ key: "default", tags: [] });
    expect(((await Site.findOne({ key: "default" }).lean()) as { adLifetimeHours?: number }).adLifetimeHours).toBeUndefined();
  });

  it("every visitor-facing word says 48 hours", () => {
    expect(TEXT_DEFAULTS["home.utility.ticker2"]).toBe("Fresh ads, live for 48 hours");
    expect(defaultShellConfig().home.trust.map((pill) => pill.label)).toContain("Ads live for 48 hours");
  });
});

describe("a visitor never sees an ad past its end time (H7.158)", () => {
  it("the public query leaves out an active ad whose end time has passed, even if the cron has not run", async () => {
    const live = await ad("Still live", 5);
    const none = await ad("No end time", null);
    const late = await ad("Cron is late", -1);
    const filter = await buildFilter({});
    expect(filter).not.toBeNull();
    const found = (await Listing.find(filter!).select("_id").lean<{ _id: mongoose.Types.ObjectId }[]>()).map((row) => String(row._id)).sort();
    expect(found).toEqual([live, none].sort());
    expect(found).not.toContain(late);
    expect(await Listing.countDocuments(filter!)).toBe(2);
  });

  it("an ad drops out at its end time", async () => {
    await Listing.create({
      ownerId: new mongoose.Types.ObjectId(),
      categoryId: new mongoose.Types.ObjectId(),
      status: "active",
      title: "Ends now",
      description: "A description that is long enough",
      publishedAt: new Date(Date.now() - HOUR),
      expiresAt: new Date(Date.now() + 200),
      slug: "ends-now-1",
    });
    expect(await Listing.countDocuments((await buildFilter({}))!)).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await Listing.countDocuments((await buildFilter({}))!)).toBe(0);
  });

  it("the search box suggestions leave out an ad past its end time", async () => {
    await ad("Bicycle live", 5);
    await ad("Bicycle late", -1);
    const result = await suggestSearch("Bicycle");
    const labels = JSON.stringify(result);
    expect(labels).toContain("Bicycle live");
    expect(labels).not.toContain("Bicycle late");
  });
});

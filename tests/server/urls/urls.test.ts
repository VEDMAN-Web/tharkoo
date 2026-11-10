import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { shardEntries } from "@/lib/seo/sitemaps";
import { adPath, categoryPath, placePath, validateSlug } from "@/lib/urls";
import { getCategory, getLocationBySlug } from "@/lib/queries";
import { siteUrl } from "@/lib/utils";
import { Category, Listing, Location, Site } from "@/server/models";
import { decideRequest, getPaths, getUrlOverride, invalidateUrlCache, renameAd, renameCategory, renameLocation, saveRedirect, saveUrlOverride, setPrefixes } from "@/server/urls/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

function resetDbCache() {
  const globalForMongo = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (globalForMongo.mongoose) {
    globalForMongo.mongoose.conn = null;
    globalForMongo.mongoose.promise = null;
  }
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  resetDbCache();
  await connectMemoryMongo();
  const globalForMongo = globalThis as { mongoose?: { conn: typeof mongoose; promise: Promise<typeof mongoose> } };
  globalForMongo.mongoose = { conn: mongoose, promise: Promise.resolve(mongoose) };
});

afterAll(async () => {
  await disconnectMemoryMongo();
  resetDbCache();
});

beforeEach(async () => {
  await clearMemoryMongo();
  invalidateUrlCache();
  invalidateTags(["site", "categories", "locations", "feed", "listings"]);
});

async function fixture() {
  await Site.create({ key: "default", name: "Tharkoo" });
  const category = await Category.create({ slug: "dating", name: "Dating", enabled: true });
  const country = await Location.create({ type: "country", slug: "india", name: "India", enabled: true });
  const state = await Location.create({ type: "state", slug: "delhi-state", name: "Delhi", parentId: country._id, enabled: true });
  const city = await Location.create({ type: "city", slug: "delhi", name: "Delhi", parentId: state._id, enabled: true });
  const ad = await Listing.create({
    ownerId: new mongoose.Types.ObjectId(),
    categoryId: category._id,
    stateId: state._id,
    cityId: city._id,
    title: "Office assistant",
    slug: "office-assistant-0001",
    description: "A weekday office role.",
    status: "active",
    seoNoindex: false,
  });
  await Listing.create([
    { ownerId: ad.ownerId, categoryId: category._id, stateId: state._id, cityId: city._id, title: "Second role", slug: "second-role-0002", description: "Another weekday role.", status: "active", seoNoindex: false },
    { ownerId: ad.ownerId, categoryId: category._id, stateId: state._id, cityId: city._id, title: "Third role", slug: "third-role-0003", description: "A third weekday role.", status: "active", seoNoindex: false },
  ]);
  return { category, city, ad };
}

describe("url manager", () => {
  it("rejects reserved and empty slugs and keeps letters lowercase", () => {
    expect(validateSlug("Admin").ok).toBe(false);
    expect(validateSlug("---").ok).toBe(false);
    const parsed = validateSlug("New Delhi");
    expect(parsed.ok && parsed.slug).toBe("new-delhi");
  });

  it("redirects a renamed category, city, and ad prefix without dropping the new urls", async () => {
    const { category, city, ad } = await fixture();
    await renameCategory(String(category._id), "social");
    await renameLocation(String(city._id), "new-delhi");
    await setPrefixes({ ad: "listing" });

    const oldCity = await decideRequest("/dating/delhi/sector/");
    expect(oldCity).toMatchObject({ action: "redirect", to: "/social/new-delhi/sector/" });
    const oldAd = await decideRequest("/ad/office-assistant-0001/");
    expect(oldAd).toMatchObject({ action: "redirect", to: "/listing/office-assistant-0001/" });
    const freshAd = await decideRequest("/listing/office-assistant-0001/");
    expect(freshAd).toMatchObject({ action: "rewrite", to: "/ad/office-assistant-0001/" });

    const paths = await getPaths();
    expect(categoryPath("social")).toBe("/social/");
    expect(placePath("social", "new-delhi")).toBe("/social/new-delhi/");
    expect(adPath(paths, "office-assistant-0001")).toBe("/listing/office-assistant-0001/");

    const foundCategory = await getCategory("dating");
    const foundCity = await getLocationBySlug("delhi");
    expect(foundCategory?.slug).toBe("social");
    expect(foundCity?.slug).toBe("new-delhi");
    expect(await Listing.exists({ _id: ad._id, slug: "office-assistant-0001" })).toBeTruthy();

    const cities = await shardEntries("cities");
    const ads = await shardEntries("ads");
    const origin = siteUrl().replace(/\/$/, "");
    expect(cities.some((entry) => entry.loc === `${origin}/social/new-delhi/`)).toBe(true);
    expect(cities.some((entry) => entry.loc.includes("/dating/delhi/"))).toBe(false);
    expect(ads.some((entry) => entry.loc === `${origin}/listing/office-assistant-0001/`)).toBe(true);
    expect(ads.some((entry) => entry.loc.includes("/ad/office-assistant-0001/"))).toBe(false);
  });

  it("keeps the ad id when the title slug changes and stores an seo override", async () => {
    const { ad } = await fixture();
    const slug = await renameAd(String(ad._id), "front desk");
    expect(slug).toBe("front-desk-0001");
    const moved = await decideRequest("/ad/office-assistant-0001/");
    expect(moved).toMatchObject({ action: "redirect", to: "/ad/front-desk-0001/" });
    await saveUrlOverride({ path: "/ad/front-desk-0001/", title: "Front desk", h1: "Front desk role", noindex: true });
    const over = await getUrlOverride("/ad/front-desk-0001");
    expect(over?.title).toBe("Front desk");
    expect(over?.noindex).toBe(true);
  });

  it("collapses a redirect chain and refuses a loop", async () => {
    await fixture();
    await saveRedirect("/old/", "/mid/");
    await saveRedirect("/mid/", "/new/");
    await expect(decideRequest("/old/")).resolves.toMatchObject({ action: "redirect", to: "/new/" });
    await expect(saveRedirect("/new/", "/old/")).rejects.toThrow(/loop/i);
  });
});

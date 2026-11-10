import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Category,
  CreditPack,
  FeatureFlag,
  Listing,
  Location,
  PromotionOrder,
  PromotionProduct,
  SeedBackup,
} from "@/server/models";
import { categoryDenied, productCodeDenied } from "@/server/shared/policy";
import {
  CATEGORIES,
  DEFAULT_CREDIT_PACKS,
  expectedSeedCounts,
  FEATURE_FLAGS,
  LOCATION_LEVELS,
  PRODUCTS,
  DEMO_LISTING_COUNT,
  DISTRICTS,
  TOP_CITY_SLUGS,
  CITIES,
  demoListings,
} from "@/server/seed/data";
import { dryRunSeed, formatDryRun, rollbackSeed, runSeed, SEED_BATCH } from "@/server/seed/run";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

it("gives every city and category 12 to 20 ads and covers the Delhi districts", () => {
  const rows = demoListings();
  for (const city of CITIES) {
    for (const category of CATEGORIES) {
      const count = rows.filter((row) => row.citySlug === city[0] && row.categorySlug === category.slug).length;
      expect(count, `${category.slug} in ${city[0]}`).toBeGreaterThanOrEqual(12);
      expect(count, `${category.slug} in ${city[0]}`).toBeLessThanOrEqual(20);
    }
  }
  for (const slug of ["central-delhi", "new-delhi", "south-delhi"]) {
    expect(DISTRICTS.delhi?.some((district) => district[0] === slug)).toBe(true);
    expect(rows.some((row) => row.citySlug === "delhi" && row.districtSlug === slug && row.categorySlug === "dating")).toBe(true);
  }
  expect(TOP_CITY_SLUGS.length).toBeGreaterThan(0);
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  delete process.env.SEED_CREDIT_PACKS;
  await connectMemoryMongo();
});

afterAll(async () => {
  delete process.env.SEED_CREDIT_PACKS;
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  delete process.env.SEED_CREDIT_PACKS;
  await clearMemoryMongo();
});

async function counts() {
  const [locations, categories, products, packs, flags] = await Promise.all([
    Location.countDocuments(),
    Category.countDocuments(),
    PromotionProduct.countDocuments(),
    CreditPack.countDocuments(),
    FeatureFlag.countDocuments(),
  ]);
  return { locations, categories, products, packs, flags };
}

describe("v2 seed", () => {
  it("inserts the catalogue once and leaves counts unchanged on a second run", async () => {
    const dropDatabase = vi.spyOn(mongoose.connection, "dropDatabase");
    const dropCollection = vi.spyOn(mongoose.connection, "dropCollection");
    const expected = expectedSeedCounts();
    expect(expected.states).toBe(36);
    expect(expected.cities).toBeGreaterThanOrEqual(50);
    expect(expected.citiesWithDistricts).toBe(TOP_CITY_SLUGS.length);
    expect(expected.categories).toBe(11);
    expect(expected.promotion_products).toBe(8);
    expect(expected.credit_packs).toBe(DEFAULT_CREDIT_PACKS.length);
    expect(expected.feature_flags).toBe(FEATURE_FLAGS.length);

    const first = await runSeed();
    expect(first.batch).toBe(SEED_BATCH);
    expect(first.locations).toEqual({ inserted: expected.locations, skipped: 0 });
    expect(first.categories).toEqual({ inserted: expected.categories, skipped: 0 });
    expect(first.promotion_products).toEqual({ inserted: expected.promotion_products, skipped: 0 });
    expect(first.credit_packs).toEqual({ inserted: expected.credit_packs, skipped: 0 });
    expect(first.feature_flags).toEqual({ inserted: expected.feature_flags, skipped: 0 });
    expect(first.listings).toEqual({ inserted: expected.listings, skipped: 0 });
    expect(expected.listings).toBe(DEMO_LISTING_COUNT);
    const afterFirst = await counts();
    expect(afterFirst).toEqual({
      locations: expected.locations,
      categories: expected.categories,
      products: expected.promotion_products,
      packs: expected.credit_packs,
      flags: expected.feature_flags,
    });

    const city = await Location.findOne({ type: "city", slug: "pune" });
    const stamp = city?.updatedAt?.getTime();
    const promosAfterFirst = await PromotionOrder.countDocuments({ status: "active" });
    expect(promosAfterFirst).toBeGreaterThan(0);
    const second = await runSeed();
    expect(second.locations).toEqual({ inserted: 0, skipped: expected.locations });
    expect(second.categories.inserted).toBe(0);
    expect(second.promotion_products.inserted).toBe(0);
    expect(second.credit_packs.inserted).toBe(0);
    expect(second.feature_flags.inserted).toBe(0);
    expect(second.listings).toEqual({ inserted: 0, skipped: expected.listings });
    expect(await Listing.countDocuments({ status: "active" })).toBe(expected.listings);
    expect(await PromotionOrder.countDocuments({ status: "active" })).toBe(promosAfterFirst);
    expect(await counts()).toEqual(afterFirst);
    const cityAgain = await Location.findOne({ type: "city", slug: "pune" });
    expect(cityAgain?.name).toBe("Pune");
    expect(cityAgain?.updatedAt?.getTime()).toBe(stamp);
    expect(dropDatabase).not.toHaveBeenCalled();
    expect(dropCollection).not.toHaveBeenCalled();
    expect(await SeedBackup.countDocuments()).toBe(2);
    dropDatabase.mockRestore();
    dropCollection.mockRestore();
  });

  it("seeds India on the five-level location type and the neutral catalogue", async () => {
    await runSeed();
    const expected = expectedSeedCounts();
    expect(Location.schema.path("type").options.enum).toEqual([...LOCATION_LEVELS]);
    expect(await Location.countDocuments({ type: "country" })).toBe(1);
    expect(await Location.countDocuments({ type: "state" })).toBe(36);
    expect(await Location.countDocuments({ type: "city" })).toBe(expected.cities);
    expect(await Location.countDocuments({ type: "district" })).toBe(expected.districts);
    expect(await Location.countDocuments({ type: "locality" })).toBe(0);

    const india = await Location.findOne({ type: "country", slug: "india" });
    const state = await Location.findOne({ type: "state", slug: "maharashtra", parentId: india?._id });
    const city = await Location.findOne({ type: "city", slug: "mumbai", parentId: state?._id });
    const district = await Location.findOne({
      type: "district",
      slug: "mumbai-city",
      parentId: city?._id,
    });
    expect(district?.name).toBe("Mumbai City");
    const mysuru = await Location.findOne({ type: "city", slug: "mysuru" });
    expect(await Location.countDocuments({ parentId: mysuru?._id, type: "district" })).toBe(0);

    expect(CATEGORIES.map((category) => category.slug)).toEqual([
      "dating",
      "friendship",
      "meetups",
      "personal-ads",
      "jobs",
      "wellness",
      "property",
      "vehicles",
      "buy-and-sell",
      "pets",
      "education",
    ]);
    for (const category of CATEGORIES) {
      expect(categoryDenied(category.slug, category.name).denied).toBe(false);
    }
    const wellness = await Category.findOne({ slug: "wellness" }).lean();
    expect(wellness?.fields?.map((field) => field.key)).toEqual(["kind"]);
    expect(wellness?.fields?.[0]?.options).toEqual(["Spa", "Massage", "Yoga", "Fitness"]);
    const vehicles = await Category.findOne({ slug: "vehicles" }).lean();
    expect(vehicles?.fields?.map((field) => field.key)).toEqual(["make", "year", "km"]);

    expect(PRODUCTS.map((product) => product.code)).toEqual([
      "free",
      "top",
      "auto-boost",
      "super-top",
      "highlight",
      "new",
      "flash",
      "star",
    ]);
    for (const product of PRODUCTS) expect(productCodeDenied(product.code).denied).toBe(false);
    expect((await PromotionProduct.findOne({ code: "star" }).lean())?.name).toBe("Star");
    expect((await PromotionProduct.findOne({ code: "free" }).lean())?.amount).toBe(0);

    const packs = await CreditPack.find().sort({ order: 1 }).lean();
    expect(packs.map((pack) => pack.price)).toEqual(DEFAULT_CREDIT_PACKS.map((pack) => pack.price));
    const flagKeys = (await FeatureFlag.find().distinct("key")) as string[];
    expect([...flagKeys].sort()).toEqual(FEATURE_FLAGS.map((flag) => flag.key).sort());

    expect(Category.collection.collectionName).toBe("categories");
    expect(Location.collection.collectionName).toBe("locations");
    expect(CreditPack.collection.collectionName).toBe("credit_packs");
    expect(Listing.collection.collectionName).toBe("listings");
    expect(await mongoose.connection.collection("categories_v2").countDocuments()).toBe(0);
    expect(await mongoose.connection.collection("locations_v2").countDocuments()).toBe(0);
    expect(await mongoose.connection.collection("listings_v2").countDocuments()).toBe(0);
  });

  it("does not modify rows that already use the same natural keys", async () => {
    const india = await Location.create({
      type: "country",
      slug: "india",
      name: "Custom",
      parentId: null,
      enabled: false,
      order: 9,
      countryCode: "IN",
    });
    const dating = await Category.create({
      slug: "dating",
      name: "Custom dating",
      description: "keep",
      enabled: false,
      order: 4,
      fields: [],
    });
    const free = await PromotionProduct.create({
      code: "free",
      name: "Custom free",
      description: "keep",
      amount: 1,
      currency: "INR",
      durationDays: 1,
      enabled: false,
    });
    await CreditPack.create({ credits: 100, price: 1000, bonus: 9, tag: "keep", order: 3, status: "paused" });
    const stamp = india.updatedAt?.getTime();

    await runSeed();

    const indiaAgain = await Location.findById(india._id);
    expect(indiaAgain?.name).toBe("Custom");
    expect(indiaAgain?.enabled).toBe(false);
    expect(indiaAgain?.seedBatch ?? null).toBeNull();
    expect(indiaAgain?.updatedAt?.getTime()).toBe(stamp);
    const datingAgain = await Category.findById(dating._id).lean();
    expect(datingAgain?.name).toBe("Custom dating");
    expect(datingAgain?.fields).toEqual([]);
    const freeAgain = await PromotionProduct.findById(free._id);
    expect(freeAgain?.name).toBe("Custom free");
    expect(freeAgain?.amount).toBe(1);
    const pack = await CreditPack.findOne({ credits: 100, price: 1000 }).lean();
    expect(pack?.tag).toBe("keep");
    expect(pack?.bonus).toBe(9);
    expect((await Location.findOne({ type: "state", slug: "kerala" }))?.seedBatch).toBe(SEED_BATCH);
  });

  it("dry-run prints a plan and writes nothing", async () => {
    const plan = await dryRunSeed();
    const expected = expectedSeedCounts();
    expect(plan.locations.insert).toHaveLength(expected.locations);
    expect(plan.locations.skip).toHaveLength(0);
    expect(plan.categories.insert).toEqual(CATEGORIES.map((category) => category.slug));
    expect(plan.promotion_products.insert).toEqual(PRODUCTS.map((product) => product.code));
    expect(plan.listings.insert).toHaveLength(expected.listings);
    expect(plan.listings.skip).toHaveLength(0);
    expect(plan.creditPacksSource).toBe("table");
    expect(await Listing.countDocuments()).toBe(0);
    expect(formatDryRun(plan).startsWith("SEED_DRY_RUN ")).toBe(true);
    expect(await counts()).toEqual({ locations: 0, categories: 0, products: 0, packs: 0, flags: 0 });
    expect(await SeedBackup.countDocuments()).toBe(0);
  });

  it("aborts without inserts when the snapshot fails", async () => {
    const spy = vi.spyOn(SeedBackup, "create").mockRejectedValueOnce(new Error("snapshot failed"));
    await expect(runSeed()).rejects.toThrow(/snapshot failed/);
    expect(await counts()).toEqual({ locations: 0, categories: 0, products: 0, packs: 0, flags: 0 });
    spy.mockRestore();
  });

  it("rollback restores the snapshot and refuses when a listing references a seeded row", async () => {
    await Location.create({
      type: "locality",
      slug: "kept-lane",
      name: "Kept Lane",
      parentId: null,
      enabled: true,
      order: 0,
      countryCode: "IN",
    });
    await runSeed();
    const seededLocations = await Location.countDocuments({ seedBatch: SEED_BATCH });
    expect(seededLocations).toBe(expectedSeedCounts().locations);
    const dating = await Category.findOne({ slug: "dating" });
    await Listing.create({
      ownerId: new mongoose.Types.ObjectId(),
      categoryId: dating!._id,
      title: "Blocks rollback",
      description: "This listing points at a seeded category.",
    });

    const refused = await rollbackSeed(SEED_BATCH);
    expect(refused).toEqual({ refused: true, listingCount: DEMO_LISTING_COUNT + 1 });
    expect(await Location.countDocuments({ slug: "kept-lane" })).toBe(1);
    expect(await Category.countDocuments({ slug: "dating" })).toBe(1);

    await Listing.deleteMany({});
    await Location.deleteMany({});
    await Category.deleteMany({});
    await PromotionProduct.deleteMany({});
    await CreditPack.deleteMany({});
    await FeatureFlag.deleteMany({});

    const restored = await rollbackSeed(SEED_BATCH);
    expect(restored).toMatchObject({
      batch: SEED_BATCH,
      restored: { locations: 1, categories: 0, promotion_products: 0, credit_packs: 0, feature_flags: 0 },
    });
    expect(await Location.countDocuments()).toBe(1);
    expect((await Location.findOne())?.name).toBe("Kept Lane");
    expect(await Category.countDocuments()).toBe(0);
    expect(await PromotionProduct.countDocuments()).toBe(0);
    expect(await SeedBackup.countDocuments()).toBe(1);
  });

  it("reads credit packs from SEED_CREDIT_PACKS when that table is set", async () => {
    process.env.SEED_CREDIT_PACKS = JSON.stringify([
      { credits: 10, price: 50, bonus: 0, tag: "Test pack", order: 0 },
    ]);
    const plan = await dryRunSeed();
    expect(plan.creditPacksSource).toBe("env");
    expect(plan.credit_packs.insert).toEqual(["10:50"]);
    expect(await CreditPack.countDocuments()).toBe(0);
    await runSeed();
    const pack = await CreditPack.findOne().lean();
    expect(pack?.credits).toBe(10);
    expect(pack?.price).toBe(50);
    expect(expectedSeedCounts().credit_packs).toBe(1);
  });
});

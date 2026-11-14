import type { Types } from "mongoose";
import { invalidateTags } from "@/lib/cache";
import { BlogPost, Category, CreditPack, FeatureFlag, HelpArticle, Listing, Location, Page, PromotionProduct, SeedBackup } from "@/server/models";
import { attributeKeyDenied, categoryDenied, productCodeDenied, textDenied } from "@/server/shared/policy";
import { repairCategoryKinds } from "@/server/categories/kind";
import { seedDemoListings } from "@/server/seed/listings";
import {
  CATEGORIES,
  CITIES,
  creditPackTable,
  DISTRICTS,
  FEATURE_FLAGS,
  PRODUCTS,
  SEED_BATCH,
  STATES,
} from "@/server/seed/data";

export { SEED_BATCH } from "@/server/seed/data";

export interface SeedTally {
  inserted: number;
  skipped: number;
}

export interface SeedResult {
  batch: string;
  backupId: string;
  locations: SeedTally;
  categories: SeedTally;
  promotion_products: SeedTally;
  credit_packs: SeedTally;
  feature_flags: SeedTally;
  listings: SeedTally;
}

export interface SeedPlan {
  batch: string;
  creditPacksSource: "table" | "env";
  locations: { insert: string[]; skip: string[] };
  categories: { insert: string[]; skip: string[] };
  promotion_products: { insert: string[]; skip: string[] };
  credit_packs: { insert: string[]; skip: string[] };
  feature_flags: { insert: string[]; skip: string[] };
  listings: { insert: string[]; skip: string[] };
}

export interface RollbackResult {
  batch: string;
  backupId: string;
  restored: {
    locations: number;
    categories: number;
    promotion_products: number;
    credit_packs: number;
    feature_flags: number;
  };
}

export interface RollbackRefusal {
  refused: true;
  listingCount: number;
}

interface Bucket {
  inserted: string[];
  skipped: string[];
}

interface PlainDoc {
  _id?: string;
  [key: string]: unknown;
}

interface SnapshotCollections {
  locations: PlainDoc[];
  categories: PlainDoc[];
  promotion_products: PlainDoc[];
  credit_packs: PlainDoc[];
  feature_flags: PlainDoc[];
}

function emptyBucket(): Bucket {
  return { inserted: [], skipped: [] };
}

function tally(bucket: Bucket): SeedTally {
  return { inserted: bucket.inserted.length, skipped: bucket.skipped.length };
}

function planSide(bucket: Bucket) {
  return { insert: bucket.inserted, skip: bucket.skipped };
}

/** Joined deny-list check. Refuses the seed rather than inserting a blocked row. */
export function assertSeedAllowed(): void {
  for (const category of CATEGORIES) {
    if (categoryDenied(category.slug, category.name).denied) {
      throw new Error(`Seed category refused: ${category.slug}`);
    }
    if (textDenied(`${category.name} ${category.description}`).denied) {
      throw new Error(`Seed category text refused: ${category.slug}`);
    }
    for (const field of category.fields) {
      if (attributeKeyDenied(field.key).denied) {
        throw new Error(`Seed field refused: ${category.slug}.${field.key}`);
      }
      const options = (field.options ?? []).join(" ");
      if (textDenied(`${field.label} ${options}`).denied) {
        throw new Error(`Seed field text refused: ${category.slug}.${field.key}`);
      }
    }
  }
  for (const product of PRODUCTS) {
    if (productCodeDenied(product.code).denied) {
      throw new Error(`Seed product refused: ${product.code}`);
    }
    if (textDenied(`${product.name} ${product.description}`).denied) {
      throw new Error(`Seed product text refused: ${product.code}`);
    }
  }
  const names = [
    "India",
    ...STATES.map((row) => row[1]),
    ...CITIES.map((row) => row[1]),
    ...Object.values(DISTRICTS).flat().map((row) => row[1]),
  ];
  for (const name of names) {
    if (textDenied(name).denied) throw new Error(`Seed place refused: ${name}`);
  }
  for (const flag of FEATURE_FLAGS) {
    if (textDenied(`${flag.key} ${flag.label}`).denied) throw new Error(`Seed flag refused: ${flag.key}`);
  }
  for (const pack of creditPackTable()) {
    if (textDenied(pack.tag).denied) throw new Error(`Seed pack tag refused at order ${pack.order}`);
  }
}

async function insertOnly(
  write: () => Promise<{ upsertedCount?: number }>,
): Promise<"inserted" | "skipped"> {
  const result = await write();
  return (result.upsertedCount ?? 0) > 0 ? "inserted" : "skipped";
}

async function place(
  findOne: () => Promise<{ _id: Types.ObjectId } | null>,
  write: () => Promise<{ upsertedCount?: number }>,
  key: string,
  dryRun: boolean,
  bucket: Bucket,
): Promise<Types.ObjectId | null> {
  const existing = await findOne();
  if (existing) {
    bucket.skipped.push(key);
    return existing._id;
  }
  if (dryRun) {
    bucket.inserted.push(key);
    return null;
  }
  const status = await insertOnly(write);
  bucket[status === "inserted" ? "inserted" : "skipped"].push(key);
  const saved = await findOne();
  if (!saved) throw new Error(`Insert failed for ${key}`);
  return saved._id;
}

async function walkLocations(dryRun: boolean): Promise<Bucket> {
  const bucket = emptyBucket();
  const countryId = await place(
    () => Location.findOne({ parentId: null, type: "country", slug: "india" }).select("_id").lean(),
    () =>
      Location.updateOne(
        { parentId: null, type: "country", slug: "india" },
        {
          $setOnInsert: {
            name: "India",
            enabled: true,
            order: 0,
            countryCode: "IN",
            seedBatch: SEED_BATCH,
          },
        },
        { upsert: true },
      ),
    "country:india",
    dryRun,
    bucket,
  );

  for (let stateOrder = 0; stateOrder < STATES.length; stateOrder += 1) {
    const state = STATES[stateOrder];
    if (!state) continue;
    const [slug, name] = state;
    let stateId: Types.ObjectId | null = null;
    if (countryId == null) bucket.inserted.push(`state:${slug}`);
    else {
      stateId = await place(
        () => Location.findOne({ parentId: countryId, type: "state", slug }).select("_id").lean(),
        () =>
          Location.updateOne(
            { parentId: countryId, type: "state", slug },
            {
              $setOnInsert: {
                name,
                enabled: true,
                order: stateOrder,
                countryCode: "IN",
                seedBatch: SEED_BATCH,
              },
            },
            { upsert: true },
          ),
        `state:${slug}`,
        dryRun,
        bucket,
      );
    }

    const cities = CITIES.filter((city) => city[2] === slug);
    for (let cityOrder = 0; cityOrder < cities.length; cityOrder += 1) {
      const city = cities[cityOrder];
      if (!city) continue;
      const [citySlug, cityName] = city;
      let cityId: Types.ObjectId | null = null;
      if (!dryRun && stateId && citySlug === "gurgaon") {
        await Location.updateOne(
          { parentId: stateId, type: "city", slug: "gurugram" },
          { $set: { slug: "gurgaon", name: "Gurgaon", oldSlugs: ["gurugram"] } },
        );
      }
      if (stateId == null) bucket.inserted.push(`city:${citySlug}`);
      else {
        cityId = await place(
          () => Location.findOne({ parentId: stateId, type: "city", slug: citySlug }).select("_id").lean(),
          () =>
            Location.updateOne(
              { parentId: stateId, type: "city", slug: citySlug },
              {
                $setOnInsert: {
                  name: cityName,
                  enabled: true,
                  order: cityOrder,
                  countryCode: "IN",
                  seedBatch: SEED_BATCH,
                  ...(citySlug === "gurgaon" ? { oldSlugs: ["gurugram"] } : {}),
                },
              },
              { upsert: true },
            ),
          `city:${citySlug}`,
          dryRun,
          bucket,
        );
      }

      const districts = DISTRICTS[citySlug] ?? [];
      for (let districtOrder = 0; districtOrder < districts.length; districtOrder += 1) {
        const district = districts[districtOrder];
        if (!district) continue;
        const [districtSlug, districtName] = district;
        if (cityId == null) {
          bucket.inserted.push(`district:${districtSlug}`);
          continue;
        }
        await place(
          () =>
            Location.findOne({ parentId: cityId, type: "district", slug: districtSlug }).select("_id").lean(),
          () =>
            Location.updateOne(
              { parentId: cityId, type: "district", slug: districtSlug },
              {
                $setOnInsert: {
                  name: districtName,
                  enabled: true,
                  order: districtOrder,
                  countryCode: "IN",
                  seedBatch: SEED_BATCH,
                },
              },
              { upsert: true },
            ),
          `district:${districtSlug}`,
          dryRun,
          bucket,
        );
      }
    }
  }
  return bucket;
}

async function walkCategories(dryRun: boolean): Promise<Bucket> {
  const bucket = emptyBucket();
  for (const category of CATEGORIES) {
    await place(
      () => Category.findOne({ slug: category.slug }).select("_id").lean(),
      () =>
        Category.updateOne(
          { slug: category.slug },
          {
            $setOnInsert: {
              name: category.name,
              description: category.description,
              enabled: category.enabled,
              order: category.order,
              fields: category.fields,
              parentId: null,
              seedBatch: SEED_BATCH,
              kind: category.kind,
              videoTourEnabled: false,
            },
          },
          { upsert: true },
        ),
      category.slug,
      dryRun,
      bucket,
    );
  }
  // Categories that already existed get their kind here, so the people rule holds on every seeded database (H6.5).
  if (!dryRun) await repairCategoryKinds();
  return bucket;
}

async function walkProducts(dryRun: boolean): Promise<Bucket> {
  const bucket = emptyBucket();
  for (const product of PRODUCTS) {
    await place(
      () => PromotionProduct.findOne({ code: product.code }).select("_id").lean(),
      () =>
        PromotionProduct.updateOne(
          { code: product.code },
          {
            $setOnInsert: {
              name: product.name,
              description: product.description,
              amount: product.amount,
              currency: product.currency,
              durationDays: product.durationDays,
              enabled: true,
              seedBatch: SEED_BATCH,
            },
          },
          { upsert: true },
        ),
      product.code,
      dryRun,
      bucket,
    );
  }
  return bucket;
}

async function walkPacks(dryRun: boolean): Promise<Bucket> {
  const bucket = emptyBucket();
  for (const pack of creditPackTable()) {
    const key = `${pack.credits}:${pack.price}`;
    await place(
      () => CreditPack.findOne({ credits: pack.credits, price: pack.price }).select("_id").lean(),
      () =>
        CreditPack.updateOne(
          { credits: pack.credits, price: pack.price },
          { $setOnInsert: { bonus: pack.bonus, tag: pack.tag, order: pack.order, status: "active" } },
          { upsert: true },
        ),
      key,
      dryRun,
      bucket,
    );
  }
  return bucket;
}

async function walkFlags(dryRun: boolean): Promise<Bucket> {
  const bucket = emptyBucket();
  for (const flag of FEATURE_FLAGS) {
    await place(
      () => FeatureFlag.findOne({ key: flag.key }).select("_id").lean(),
      () =>
        FeatureFlag.updateOne(
          { key: flag.key },
          { $setOnInsert: { label: flag.label, enabled: flag.enabled } },
          { upsert: true },
        ),
      flag.key,
      dryRun,
      bucket,
    );
  }
  return bucket;
}

function toPlain(docs: unknown[]): PlainDoc[] {
  return JSON.parse(JSON.stringify(docs)) as PlainDoc[];
}

async function snapshot(): Promise<{ backupId: string }> {
  const [locations, categories, products, packs, flags] = await Promise.all([
    Location.find().lean(),
    Category.find().lean(),
    PromotionProduct.find().lean(),
    CreditPack.find().lean(),
    FeatureFlag.find().lean(),
  ]);
  const backup = await SeedBackup.create({
    batch: SEED_BATCH,
    takenAt: new Date(),
    counts: {
      locations: locations.length,
      categories: categories.length,
      promotion_products: products.length,
    },
    collections: {
      locations: toPlain(locations),
      categories: toPlain(categories),
      promotion_products: toPlain(products),
      credit_packs: toPlain(packs),
      feature_flags: toPlain(flags),
    },
  });
  return { backupId: backup._id.toString() };
}

/** Read-only plan. Does not write seed rows or seed_backups. */
export async function dryRunSeed(): Promise<SeedPlan> {
  assertSeedAllowed();
  const [locations, categories, products, packs, flags, listings] = await Promise.all([
    walkLocations(true),
    walkCategories(true),
    walkProducts(true),
    walkPacks(true),
    walkFlags(true),
    seedDemoListings(true),
  ]);
  return {
    batch: SEED_BATCH,
    creditPacksSource: process.env.SEED_CREDIT_PACKS ? "env" : "table",
    locations: planSide(locations),
    categories: planSide(categories),
    promotion_products: planSide(products),
    credit_packs: planSide(packs),
    feature_flags: planSide(flags),
    listings: planSide(listings),
  };
}

export function formatDryRun(plan: SeedPlan): string {
  return `SEED_DRY_RUN ${JSON.stringify(plan)}`;
}

/** Insert-only. Snapshots first and inserts nothing if that write fails. */
export async function runSeed(): Promise<SeedResult> {
  assertSeedAllowed();
  const backup = await snapshot();
  const [locations, categories, products, packs, flags] = await Promise.all([
    walkLocations(false),
    walkCategories(false),
    walkProducts(false),
    walkPacks(false),
    walkFlags(false),
  ]);
  const listings = await seedDemoListings(false);
  const { ensureHomepageDocument } = await import("@/lib/ui/site-store");
  await ensureHomepageDocument();
  const { seedLayouts } = await import("@/server/seed/layouts");
  await seedLayouts();
  await seedEditorial();
  // Seeded copy must not carry em or en dashes (relay #42).
  const { repairDashes } = await import("@/server/content/dash-repair");
  await repairDashes(`seed:${SEED_BATCH}`);
  invalidateTags(["categories", "locations", "listings", "feed", "counts", "site"]);
  return {
    batch: SEED_BATCH,
    backupId: backup.backupId,
    locations: tally(locations),
    categories: tally(categories),
    promotion_products: tally(products),
    credit_packs: tally(packs),
    feature_flags: tally(flags),
    listings: tally(listings),
  };
}

async function seedEditorial() {
  const { ABOUT_BODY, GRIEVANCE_BODY, publishedGuides } = await import("@/content/editorial");
  const pages = [
    { slug: "about", title: "About Tharkoo", body: ABOUT_BODY },
    { slug: "grievance", title: "Grievance", body: GRIEVANCE_BODY },
  ];
  for (const page of pages) {
    await Page.updateOne({ slug: page.slug }, { $setOnInsert: { ...page, status: "published" } }, { upsert: true });
  }
  for (const guide of publishedGuides()) {
    const update = { $setOnInsert: { slug: guide.slug, title: guide.title, body: guide.body, status: guide.status, date: "November 2026", author: "Tharkoo" } };
    if (guide.kind === "help") await HelpArticle.updateOne({ slug: guide.slug }, update, { upsert: true });
    else await BlogPost.updateOne({ slug: guide.slug }, update, { upsert: true });
  }
}

function rows(value: unknown): PlainDoc[] {
  return Array.isArray(value) ? (value as PlainDoc[]) : [];
}

function removedIds(current: { _id: Types.ObjectId }[], snapshotRows: PlainDoc[]): Types.ObjectId[] {
  const kept = new Set(snapshotRows.map((doc) => String(doc._id)));
  return current.filter((doc) => !kept.has(String(doc._id))).map((doc) => doc._id);
}

/**
 * Puts locations, categories, promotion products, credit packs, and feature flags
 * back to the latest seed_backups snapshot for this batch. Refuses when a listing
 * points at a row that would disappear.
 */
export async function rollbackSeed(batch = SEED_BATCH): Promise<RollbackResult | RollbackRefusal> {
  if (!/^seed-\d{4}-\d{2}-\d{2}$/.test(batch)) throw new Error("Pass --batch seed-YYYY-MM-DD");
  const backup = await SeedBackup.findOne({ batch }).sort({ takenAt: -1, _id: -1 });
  if (!backup) throw new Error(`No seed backup for ${batch}`);
  const collections = backup.collections as unknown as SnapshotCollections;
  const locationRows = rows(collections.locations);
  const categoryRows = rows(collections.categories);
  const [locations, categories] = await Promise.all([
    Location.find().select("_id"),
    Category.find().select("_id"),
  ]);
  const locationIds = removedIds(locations, locationRows);
  const categoryIds = removedIds(categories, categoryRows);
  const or: Record<string, unknown>[] = [];
  if (locationIds.length > 0) {
    or.push(
      { stateId: { $in: locationIds } },
      { cityId: { $in: locationIds } },
      { districtId: { $in: locationIds } },
      { localityId: { $in: locationIds } },
    );
  }
  if (categoryIds.length > 0) or.push({ categoryId: { $in: categoryIds } });
  const listingCount = or.length > 0 ? await Listing.countDocuments({ $or: or }) : 0;
  if (listingCount > 0) return { refused: true, listingCount };

  const productRows = rows(collections.promotion_products);
  const packRows = rows(collections.credit_packs);
  const flagRows = rows(collections.feature_flags);
  await Promise.all([
    replaceDocs(Location, locationRows),
    replaceDocs(Category, categoryRows),
    replaceDocs(PromotionProduct, productRows),
    replaceDocs(CreditPack, packRows),
    replaceDocs(FeatureFlag, flagRows),
  ]);
  return {
    batch,
    backupId: backup._id.toString(),
    restored: {
      locations: locationRows.length,
      categories: categoryRows.length,
      promotion_products: productRows.length,
      credit_packs: packRows.length,
      feature_flags: flagRows.length,
    },
  };
}

async function replaceDocs(
  model: {
    deleteMany: (filter: Record<string, never>) => Promise<unknown>;
    insertMany: (docs: PlainDoc[]) => Promise<unknown>;
  },
  docs: PlainDoc[],
) {
  await model.deleteMany({});
  if (docs.length > 0) await model.insertMany(docs);
}

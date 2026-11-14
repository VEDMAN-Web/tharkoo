import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { Types } from "mongoose";
import { Category, Listing, Location, MediaAsset, PromotionOrder, PromotionProduct, User } from "@/server/models";
import { textDenied } from "@/server/shared/policy";
import { adLifetimeMs } from "@/server/listings/lifetime";
import { demoListings, SEED_USER_EMAIL, type DemoListing } from "@/server/seed/data";

function demoWhen(index: number) {
  const daysAgo = 1 + (index % 30);
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

function demoContact(index: number) {
  const phone = `+9198000${String(index).padStart(5, "0")}`;
  return {
    phone,
    whatsapp: phone,
    telegram: `tharkoo${String(index).padStart(4, "0")}`,
    acceptForm: false,
  };
}

const PEOPLE = new Set(["dating", "friendship", "meetups", "personal-ads", "wellness"]);

function photoFiles(category: string) {
  const dir = path.join(process.cwd(), "public", "placeholders", PEOPLE.has(category) ? "profiles" : category);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d+\.webp$/.test(name))
    .sort();
}

export async function seedDemoListings(dryRun: boolean): Promise<{ inserted: string[]; skipped: string[] }> {
  const specs = demoListings();
  for (const spec of specs) {
    if (textDenied(`${spec.title} ${spec.description}`).denied) {
      throw new Error(`Seed listing refused: ${spec.slug}`);
    }
  }
  const existing = await Listing.find({ slug: { $in: specs.map((spec) => spec.slug) } })
    .select("slug")
    .lean();
  const have = new Set(existing.map((row) => row.slug).filter((slug): slug is string => Boolean(slug)));
  const inserted = specs.filter((spec) => !have.has(spec.slug)).map((spec) => spec.slug);
  const skipped = specs.filter((spec) => have.has(spec.slug)).map((spec) => spec.slug);
  if (dryRun) return { inserted, skipped };

  const ownerId = await seedOwnerId();
  const pending = specs.filter((spec) => !have.has(spec.slug));
  if (pending.length > 0) {
    const categories = await Category.find().select("slug").lean();
    const categoryId = new Map(categories.map((row) => [row.slug, row._id]));
    const cities = await Location.find({ type: "city" }).select("slug parentId").lean();
    const cityBySlug = new Map(cities.map((row) => [row.slug, row]));
    const districts = await Location.find({ type: "district" }).select("slug parentId").lean();
    const districtId = new Map(districts.map((row) => [`${String(row.parentId)}:${row.slug}`, row._id]));

    const lifetime = await adLifetimeMs();
    const docs = pending.map((spec) => {
      const city = cityBySlug.get(spec.citySlug);
      const category = categoryId.get(spec.categorySlug);
      if (!city?._id || !category) throw new Error(`Seed listing missing place or category: ${spec.slug}`);
      const district = spec.districtSlug ? districtId.get(`${String(city._id)}:${spec.districtSlug}`) : undefined;
      const index = Number(spec.slug.slice(-4));
      return {
        ownerId,
        status: "active" as const,
        categoryId: category,
        stateId: city.parentId ?? undefined,
        cityId: city._id,
        districtId: district,
        title: spec.title,
        slug: spec.slug,
        description: spec.description,
        attributes: spec.attributes,
        badges: spec.verified ? ["verified"] : [],
        publishedAt: demoWhen(index),
        contact: demoContact(index),
        // H6.7: demo ads expire from the seed time, like real ads; "Refresh demo ads" renews them on staging.
        expiresAt: new Date(Date.now() + lifetime),
        seoNoindex: true,
      };
    });
    await Listing.insertMany(docs);
    await seedPromotions(ownerId, pending);
  }
  await refreshDemoRows(specs, ownerId);
  return { inserted, skipped };
}

async function seedOwnerId() {
  await User.updateOne(
    { email: SEED_USER_EMAIL },
    {
      $setOnInsert: {
        email: SEED_USER_EMAIL,
        passwordHash: "seed-user",
        displayName: "Seed",
        dateOfBirth: new Date("1990-01-15T00:00:00.000Z"),
        attestedAdultAt: new Date("2026-01-01T00:00:00.000Z"),
        emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        roles: ["user"],
        verificationStatus: "approved",
        status: "active",
      },
    },
    { upsert: true },
  );
  const user = await User.findOne({ email: SEED_USER_EMAIL }).select("_id");
  if (!user) throw new Error("Seed user was not created");
  return user._id;
}

async function ensurePlaceholderAssets(ownerId: Types.ObjectId) {
  const categories = [...new Set(demoListings().map((spec) => spec.categorySlug))];
  const byCategory = new Map<string, Types.ObjectId[]>();
  for (const category of categories) {
    const ids: Types.ObjectId[] = [];
    for (const file of photoFiles(category)) {
      const folder = PEOPLE.has(category) ? "profiles" : category;
      const objectKey = `/placeholders/${folder}/${file}`;
      const thumbKey = objectKey.replace(/\.webp$/, "-blur.webp");
      await MediaAsset.updateOne(
        { objectKey },
        {
          $setOnInsert: {
            ownerId,
            kind: "image",
            objectKey,
            thumbKey,
            status: "cleared",
            contentType: "image/webp",
            clearedAt: new Date(),
          },
        },
        { upsert: true },
      );
      const asset = await MediaAsset.findOne({ objectKey }).select("_id");
      if (asset) ids.push(asset._id);
    }
    byCategory.set(category, ids);
  }
  return byCategory;
}

async function refreshDemoRows(specs: DemoListing[], ownerId: Types.ObjectId) {
  const photos = await ensurePlaceholderAssets(ownerId);
  await Listing.collection.bulkWrite(
    specs.map((spec) => {
      const index = Number(spec.slug.slice(-4));
      const pool = photos.get(spec.categorySlug) ?? [];
      const count = pool.length ? (PEOPLE.has(spec.categorySlug) ? Math.min(4, pool.length) : 1 + (index % Math.min(4, pool.length))) : 0;
      const mediaIds = pool.length ? Array.from({ length: count }, (_, offset) => pool[(index + offset) % pool.length]) : [];
      const $set: Record<string, unknown> = {
        publishedAt: demoWhen(index),
        contact: demoContact(index),
      };
      if (spec.bumped) $set.bumpedAt = $set.publishedAt;
      if (mediaIds.length) {
        $set.mediaIds = mediaIds;
        $set.coverMediaId = mediaIds[0];
      }
      return { updateOne: { filter: { slug: spec.slug }, update: { $set } } };
    }),
  );
}

async function seedPromotions(ownerId: Types.ObjectId, specs: DemoListing[]) {
  const wanted = specs.filter((spec): spec is DemoListing & { promotionCode: NonNullable<DemoListing["promotionCode"]> } =>
    Boolean(spec.promotionCode),
  );
  if (wanted.length === 0) return;
  const products = await PromotionProduct.find({
    code: { $in: wanted.map((spec) => spec.promotionCode) },
  })
    .select("code durationDays")
    .lean();
  const productByCode = new Map(products.map((product) => [product.code, product]));
  const listings = await Listing.find({ slug: { $in: wanted.map((spec) => spec.slug) } })
    .select("slug")
    .lean();
  const listingBySlug = new Map(listings.map((row) => [row.slug, row._id]));
  const startsAt = new Date(Date.now() - 60_000);
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const orders = wanted.map((spec) => {
    const product = productByCode.get(spec.promotionCode ?? "");
    const listingId = listingBySlug.get(spec.slug);
    if (!product?._id || !listingId) throw new Error(`Seed promotion missing product ${spec.promotionCode}`);
    return {
      userId: ownerId,
      listingId,
      productId: product._id,
      status: "active" as const,
      durationDays: product.durationDays,
      startsAt,
      endsAt,
    };
  });
  await PromotionOrder.insertMany(orders);
}

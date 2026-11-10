import { Types } from "mongoose";
import { Category, Listing, Location, PromotionOrder, PromotionProduct, User } from "@/server/models";
import { textDenied } from "@/server/shared/policy";
import { demoListings, SEED_USER_EMAIL, type DemoListing } from "@/server/seed/data";

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
  if (dryRun || inserted.length === 0) return { inserted, skipped };

  const ownerId = await seedOwnerId();
  const pending = specs.filter((spec) => !have.has(spec.slug));
  const categories = await Category.find().select("slug").lean();
  const categoryId = new Map(categories.map((row) => [row.slug, row._id]));
  const cities = await Location.find({ type: "city" }).select("slug parentId").lean();
  const cityBySlug = new Map(cities.map((row) => [row.slug, row]));
  const districts = await Location.find({ type: "district" }).select("slug parentId").lean();
  const districtId = new Map(districts.map((row) => [`${String(row.parentId)}:${row.slug}`, row._id]));

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
      publishedAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000),
      seoNoindex: true,
    };
  });
  await Listing.insertMany(docs);
  await markBumps(pending);
  await seedPromotions(ownerId, pending);
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

async function markBumps(specs: DemoListing[]) {
  const bumped = specs.filter((spec) => spec.bumped);
  if (bumped.length === 0) return;
  await Listing.collection.bulkWrite(
    bumped.map((spec) => {
      const index = Number(spec.slug.slice(-4));
      return {
        updateOne: {
          filter: { slug: spec.slug },
          update: { $set: { bumpedAt: new Date(Date.UTC(2026, 0, 2) + index * 60_000) } },
        },
      };
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

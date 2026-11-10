import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as catalogGet } from "@/app/api/catalog/route";
import { GET as searchGet } from "@/app/api/search/route";
import { cached, invalidateTags } from "@/lib/cache";
import { Category, Listing, Location, PromotionOrder, PromotionProduct } from "@/server/models";
import { queryListings } from "@/server/search";
import { getCities, getFeed, isThin, listingCountsByCategoryCity, searchListings } from "@/lib/queries";
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
});

afterAll(async () => {
  await disconnectMemoryMongo();
  resetDbCache();
});

beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["site", "categories", "locations", "listings", "feed", "counts"]);
});

async function place() {
  const category = await Category.create({
    slug: "jobs",
    name: "Jobs",
    enabled: true,
    order: 0,
    fields: [{ key: "role", label: "Role", type: "text", filterable: true, enabled: true }],
  });
  const other = await Category.create({ slug: "vehicles", name: "Vehicles", enabled: true, order: 1, fields: [] });
  const hidden = await Category.create({ slug: "hidden-jobs", name: "Hidden", enabled: false, order: 2, fields: [] });
  const state = await Location.create({
    type: "state",
    slug: "maharashtra",
    name: "Maharashtra",
    parentId: null,
    enabled: true,
    order: 0,
  });
  const city = await Location.create({
    type: "city",
    slug: "pune",
    name: "Pune",
    parentId: state._id,
    enabled: true,
    order: 0,
  });
  const area = await Location.create({
    type: "district",
    slug: "pune-city",
    name: "Pune City",
    parentId: city._id,
    enabled: true,
    order: 0,
  });
  const elsewhere = await Location.create({
    type: "city",
    slug: "mumbai",
    name: "Mumbai",
    parentId: state._id,
    enabled: true,
    order: 1,
  });
  return { category, other, hidden, state, city, area, elsewhere };
}

async function listing(input: {
  categoryId: mongoose.Types.ObjectId;
  stateId: mongoose.Types.ObjectId;
  cityId: mongoose.Types.ObjectId;
  districtId?: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  status?: "draft" | "pending" | "active" | "rejected" | "paused" | "expired" | "archived" | "removed" | "deleted";
  badges?: string[];
  publishedAt?: Date;
  bumpedAt?: Date;
  attributes?: Record<string, unknown>;
  media?: boolean;
  contact?: { phone?: string; whatsapp?: string; telegram?: string };
}) {
  const created = await Listing.create({
    ownerId: new mongoose.Types.ObjectId(),
    categoryId: input.categoryId,
    stateId: input.stateId,
    cityId: input.cityId,
    districtId: input.districtId,
    title: input.title,
    slug: input.slug,
    description: `${input.title}. A mundane classified.`,
    status: input.status ?? "active",
    badges: input.badges ?? [],
    publishedAt: input.publishedAt ?? new Date("2026-06-01T00:00:00.000Z"),
    attributes: input.attributes ?? {},
    mediaIds: input.media ? [new mongoose.Types.ObjectId()] : [],
  });
  const extra: Record<string, unknown> = {};
  if (input.bumpedAt) extra.bumpedAt = input.bumpedAt;
  if (input.contact) extra.contact = input.contact;
  if (Object.keys(extra).length > 0) {
    await Listing.collection.updateOne({ _id: created._id }, { $set: extra });
  }
  return created;
}

async function promote(listingId: mongoose.Types.ObjectId, code: string) {
  const product = await PromotionProduct.create({
    code,
    name: code,
    description: `${code} placement`,
    amount: 100,
    currency: "INR",
    durationDays: 7,
    enabled: true,
  });
  await PromotionOrder.create({
    userId: new mongoose.Types.ObjectId(),
    listingId,
    productId: product._id,
    status: "active",
    durationDays: 7,
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: new Date("2027-01-01T00:00:00.000Z"),
  });
}

describe("public search", () => {
  it("ranks promotions first, then verified, then freshness, and hides non-active rows", async () => {
    const geo = await place();
    const star = await listing({
      ...ids(geo),
      title: "Star office role",
      slug: "star-role",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const top = await listing({
      ...ids(geo),
      title: "Top office role",
      slug: "top-role",
      publishedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    const verified = await listing({
      ...ids(geo),
      title: "Verified office role",
      slug: "verified-role",
      badges: ["verified"],
      publishedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    const plain = await listing({
      ...ids(geo),
      title: "Plain office role",
      slug: "plain-role",
      publishedAt: new Date("2026-08-01T00:00:00.000Z"),
      bumpedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await listing({
      ...ids(geo),
      title: "Draft office role",
      slug: "draft-role",
      status: "draft",
    });
    await listing({
      ...ids(geo),
      title: "Paused office role",
      slug: "paused-role",
      status: "paused",
    });
    await listing({
      ...ids(geo),
      title: "Removed office role",
      slug: "removed-role",
      status: "removed",
    });
    await promote(star._id, "star");
    await promote(top._id, "top");

    const ranked = await queryListings({ sort: "ranked", pageSize: 20 });
    expect(ranked.hits.map((hit) => hit.slug)).toEqual([
      "star-role",
      "top-role",
      "verified-role",
      "plain-role",
    ]);
    expect(ranked.hits[0]?.variant).toBe("star");
    expect(ranked.hits[1]?.variant).toBe("top");
    expect(ranked.legacy.map((row) => row.slug)).toEqual(ranked.hits.map((hit) => hit.slug));

    const fresh = await queryListings({ sort: "fresh", pageSize: 20 });
    expect(fresh.hits[0]?.slug).toBe("plain-role");
    expect(fresh.hits.map((hit) => hit.slug)).not.toContain("draft-role");
    expect(plain.slug).toBe("plain-role");
    expect(verified.badges).toEqual(["verified"]);
  });

  it("filters text, category, city, area, attributes, verified, badge, and photos", async () => {
    const geo = await place();
    await listing({
      ...ids(geo),
      districtId: geo.area._id,
      title: "Bicycle office assistant",
      slug: "bike-role",
      attributes: { role: "Office assistant" },
      badges: ["verified", "local-badge"],
      media: true,
    });
    await listing({
      ...ids(geo),
      title: "Shop helper role",
      slug: "shop-role",
      attributes: { role: "Shop helper" },
    });
    await listing({
      ...ids(geo, geo.other._id, geo.elsewhere._id),
      title: "Bicycle in Mumbai",
      slug: "bike-mumbai",
    });
    const secret = await listing({
      ...ids(geo),
      title: "Desk role with a secret",
      slug: "secret-role",
      contact: { phone: "9000011111", whatsapp: "9000022222", telegram: "secret_handle" },
    });
    expect(secret.slug).toBe("secret-role");

    const text = await queryListings({ q: "bicycle", pageSize: 20 });
    expect(text.hits.map((hit) => hit.slug).sort()).toEqual(["bike-mumbai", "bike-role"]);

    const category = await queryListings({ categorySlug: "jobs", citySlug: "pune", pageSize: 20 });
    expect(category.hits.every((hit) => hit.categorySlug === "jobs" && hit.citySlug === "pune")).toBe(true);
    expect(category.hits.map((hit) => hit.slug)).not.toContain("bike-mumbai");

    const area = await queryListings({ areaSlug: "pune-city", pageSize: 20 });
    expect(area.hits.map((hit) => hit.slug)).toEqual(["bike-role"]);

    const attributes = await queryListings({
      categorySlug: "jobs",
      attributes: { role: "Office assistant" },
      pageSize: 20,
    });
    expect(attributes.hits.map((hit) => hit.slug)).toEqual(["bike-role"]);

    const verified = await queryListings({ verified: true, pageSize: 20 });
    expect(verified.hits.map((hit) => hit.slug)).toEqual(["bike-role"]);

    const badge = await queryListings({ badge: "local-badge", pageSize: 20 });
    expect(badge.hits.map((hit) => hit.slug)).toEqual(["bike-role"]);

    const photos = await queryListings({ photos: true, pageSize: 20 });
    expect(photos.hits.map((hit) => hit.slug)).toEqual(["bike-role"]);
    expect(photos.hits[0]?.photos).toEqual([]);

    const body = JSON.stringify(text.hits);
    expect(body).not.toContain("9000011111");
    expect(body).not.toContain("9000022222");
    expect(body).not.toContain("secret_handle");
    expect(body).not.toContain("whatsapp");
    expect(body).not.toContain("telegram");
    expect(body).not.toContain("phone");
  });

  it("serves the search route with coerced query params and a public envelope", async () => {
    const geo = await place();
    await listing({
      ...ids(geo),
      title: "Bicycle office assistant",
      slug: "bike-role",
      badges: ["verified"],
      attributes: { role: "Office assistant" },
    });
    const url =
      "http://localhost/api/search?q=bicycle&category=jobs&city=pune&verified=true&sort=ranked&page=1&pageSize=10&attributes=" +
      encodeURIComponent(JSON.stringify({ role: "Office assistant" }));
    const response = await searchGet(new Request(url, { headers: { "x-forwarded-for": "203.0.113.10" } }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; data: { hits: { slug: string }[]; total: number; facets: { categories: unknown[] } }; error: null };
    expect(body.ok).toBe(true);
    expect(body.error).toBeNull();
    expect(body.data.total).toBe(1);
    expect(body.data.hits[0]?.slug).toBe("bike-role");
    expect(body.data.facets.categories).toEqual([{ slug: "jobs", count: 1 }]);
    expect(JSON.stringify(body)).not.toContain("phone");

    const invalid = await searchGet(
      new Request("http://localhost/api/search?sort=price", { headers: { "x-forwarded-for": "203.0.113.10" } }),
    );
    expect(invalid.status).toBe(400);
  });

  it("keeps legacy feed filters and thin counts", async () => {
    const geo = await place();
    await listing({ ...ids(geo), title: "Office assistant", slug: "feed-one", badges: ["verified"] });
    await listing({ ...ids(geo), title: "Shop helper", slug: "feed-two" });
    await listing({
      ...ids(geo, geo.category._id, geo.elsewhere._id),
      title: "Mumbai role",
      slug: "feed-mumbai",
    });
    const feed = await getFeed({ categorySlug: "jobs", citySlug: "pune", verified: true });
    expect(feed.items.map((item) => item.slug)).toEqual(["feed-one"]);
    expect(feed.items[0]?.categorySlug).toBe("jobs");
    expect(feed.items[0]?.citySlug).toBe("pune");
    expect(feed.items[0]?.stateSlug).toBe("maharashtra");
    expect(feed.items[0]?.status).toBe("live");
    expect(feed.items[0]?.verified).toBe(true);

    const page = await searchListings({ q: "office", category: "jobs", location: "pune" });
    expect(page.items.map((item) => item.slug)).toEqual(["feed-one"]);

    const counts = await listingCountsByCategoryCity();
    expect(counts).toEqual(
      expect.arrayContaining([
        { _id: { categorySlug: "jobs", citySlug: "pune" }, n: 2 },
        { _id: { categorySlug: "jobs", citySlug: "mumbai" }, n: 1 },
      ]),
    );
    expect(isThin(2)).toBe(true);
    expect(isThin(3)).toBe(false);

    const cities = await getCities();
    const pune = cities.find((city) => city.slug === "pune");
    expect(pune?.kind).toBe("city");
    expect(pune?.stateSlug).toBe("maharashtra");
    expect(pune?.status).toBe("active");
    expect(pune?.isTop).toBe(true);
  });

  it("drops tagged cache entries and leaves other keys", async () => {
    let reads = 0;
    const first = await cached("feed:demo", 60_000, async () => {
      reads += 1;
      return "one";
    }, ["listings"]);
    expect(first).toBe("one");
    expect(await cached("feed:demo", 60_000, async () => "two", ["listings"])).toBe("one");
    await cached("site:demo", 60_000, async () => "stay", ["site"]);
    invalidateTags(["listings"]);
    expect(
      await cached(
        "feed:demo",
        60_000,
        async () => {
          reads += 1;
          return "two";
        },
        ["listings"],
      ),
    ).toBe("two");
    expect(await cached("site:demo", 60_000, async () => "gone", ["site"])).toBe("stay");
    expect(reads).toBe(2);
  });

  it("returns the catalogue envelope", async () => {
    await place();
    const response = await catalogGet(new Request("http://localhost/api/catalog", { headers: { "x-forwarded-for": "203.0.113.12" } }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; data: { categories: { slug: string }[]; locations: { slug: string }[] } };
    expect(body.ok).toBe(true);
    expect(body.data.categories.map((row) => row.slug).sort()).toEqual(["jobs", "vehicles"]);
    expect(body.data.locations.map((row) => row.slug)).toContain("pune");
  });

  it("rate limits search", async () => {
    let status = 200;
    for (let i = 0; i < 61; i += 1) {
      const response = await searchGet(
        new Request("http://localhost/api/search?q=bicycle", { headers: { "x-forwarded-for": "203.0.113.99" } }),
      );
      status = response.status;
    }
    expect(status).toBe(429);
    const body = (await (
      await searchGet(new Request("http://localhost/api/search", { headers: { "x-forwarded-for": "203.0.113.99" } }))
    ).json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});

function ids(
  geo: {
    category: { _id: mongoose.Types.ObjectId };
    state: { _id: mongoose.Types.ObjectId };
    city: { _id: mongoose.Types.ObjectId };
  },
  categoryId = geo.category._id,
  cityId = geo.city._id,
) {
  return { categoryId, stateId: geo.state._id, cityId };
}

describe("listing indexes", () => {
  it("creates the catalogue indexes", async () => {
    await Listing.createIndexes();
    await Location.createIndexes();
    await Category.createIndexes();
    const listings = await Listing.collection.indexes();
    const locations = await Location.collection.indexes();
    const categories = await Category.collection.indexes();
    expect(listings.some((index) => index.key.slug === 1 && index.unique === true && index.sparse === true)).toBe(true);
    expect(
      listings.some(
        (index) =>
          index.key.status === 1 && index.key.categoryId === 1 && index.key.cityId === 1 && index.key.publishedAt === -1,
      ),
    ).toBe(true);
    expect(listings.some((index) => index.key.ownerId === 1 && index.key.status === 1)).toBe(true);
    expect(listings.some((index) => index.weights?.title === 1 && index.weights?.description === 1)).toBe(true);
    expect(
      locations.some(
        (index) => index.key.parentId === 1 && index.key.type === 1 && index.key.slug === 1 && index.unique === true,
      ),
    ).toBe(true);
    expect(locations.some((index) => index.key.type === 1 && index.key.enabled === 1 && index.key.order === 1)).toBe(true);
    expect(locations.some((index) => index.key.oldSlugs === 1)).toBe(true);
    expect(categories.some((index) => index.key.slug === 1 && index.unique === true)).toBe(true);
    expect(categories.some((index) => index.key.parentId === 1 && index.key.order === 1)).toBe(true);
    expect(categories.some((index) => index.key.oldSlugs === 1)).toBe(true);
  });
});

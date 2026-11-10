import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Category, Listing, Location, PromotionOrder, PromotionProduct, User } from "../src/server/models";
import { queryListings } from "../src/server/search";

async function main() {
  let memory: MongoMemoryServer | null = null;
  if (!process.env.MONGODB_URI) {
    memory = await MongoMemoryServer.create();
    process.env.MONGODB_URI = memory.getUri("tharkoo-p95");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const ownerId = new mongoose.Types.ObjectId();
  await User.create({
    _id: ownerId,
    email: "p95@tharkoo.local",
    passwordHash: "seed-user",
    displayName: "P95",
    dateOfBirth: new Date("1990-01-15T00:00:00.000Z"),
    attestedAdultAt: new Date("2026-01-01T00:00:00.000Z"),
    roles: ["user"],
    verificationStatus: "approved",
    status: "active",
  });
  const category = await Category.create({ slug: "vehicles", name: "Vehicles", enabled: true, order: 0 });
  const state = await Location.create({ type: "state", slug: "maharashtra", name: "Maharashtra", parentId: null, enabled: true });
  const city = await Location.create({
    type: "city",
    slug: "pune",
    name: "Pune",
    parentId: state._id,
    enabled: true,
  });
  const product = await PromotionProduct.create({
    code: "top",
    name: "TOP",
    description: "Top placement",
    amount: 499,
    currency: "INR",
    durationDays: 7,
    enabled: true,
  });
  const docs = Array.from({ length: 5000 }, (_, index) => ({
    ownerId,
    status: "active" as const,
    categoryId: category._id,
    stateId: state._id,
    cityId: city._id,
    title: index < 400 ? `Bicycle listing ${index} in Pune` : `Hatchback listing ${index} in Pune`,
    slug: `p95-${String(index).padStart(4, "0")}`,
    description: "A mundane vehicle classified in Pune.",
    publishedAt: new Date(Date.UTC(2026, 0, 1) + index * 1000),
    badges: index % 2 === 0 ? ["verified"] : [],
    seoNoindex: true,
  }));
  const created = await Listing.insertMany(docs);
  await Listing.createIndexes();
  await Category.createIndexes();
  await Location.createIndexes();
  const now = new Date();
  await PromotionOrder.insertMany(
    created.slice(0, 20).map((row) => ({
      userId: ownerId,
      listingId: row._id,
      productId: product._id,
      status: "active" as const,
      durationDays: 7,
      startsAt: new Date(now.getTime() - 60_000),
      endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    })),
  );
  const input = {
    q: "bicycle",
    categorySlug: "vehicles",
    citySlug: "pune",
    sort: "ranked" as const,
    page: 1,
    pageSize: 20,
  };
  const sample = await queryListings(input);
  if (sample.total < 100) throw new Error(`expected text matches, got ${sample.total}`);
  const samples: number[] = [];
  for (let i = 0; i < 5; i += 1) await queryListings(input);
  for (let i = 0; i < 20; i += 1) {
    const started = performance.now();
    await queryListings(input);
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1] ?? samples[samples.length - 1] ?? 0;
  console.log(`search_p95_ms ${p95.toFixed(1)}`);
  await mongoose.disconnect();
  if (memory) await memory.stop();
  if (p95 >= 150) process.exit(1);
}

main().catch(async (err: unknown) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});

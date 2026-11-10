import { afterAll, expect, test } from "vitest";
import { MongoConfigError, connectDb, mongoUri } from "@/lib/db";
import { Category } from "@/lib/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "./mongo";

test("unset MONGODB_URI throws MongoConfigError", () => {
  const previous = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  expect(() => mongoUri()).toThrow(MongoConfigError);
  expect(() => mongoUri()).toThrow(/MONGODB_URI is not set/);
  if (previous === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = previous;
});

test("connect, insert a category, read it", async () => {
  await connectMemoryMongo();
  await connectDb();
  await clearMemoryMongo();
  await Category.create({
    name: "Workshops",
    slug: "workshops",
    description: "Local workshops",
    icon: "workshop",
    color: "#2255aa",
    order: 1,
    starEnabled: false,
    status: "active",
    showOnHome: true,
    homeBlurb: "Find a workshop",
    homeCities: ["pune"],
    moreLabel: "More cities",
  });
  const found = await Category.findOne({ slug: "workshops" }).lean();
  expect(found?.name).toBe("Workshops");
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

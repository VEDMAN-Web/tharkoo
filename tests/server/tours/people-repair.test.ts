import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCategory } from "@/server/categories/manage";
import { repairCategoryKinds } from "@/server/categories/kind";
import { creditWallet, walletBalance } from "@/server/billing/ledger";
import { Category, Listing } from "@/server/models";
import { holdInEscrow } from "@/server/wallet";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const req = "req-people-repair";
const uid = () => new mongoose.Types.ObjectId().toString();

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

/** A category as it sits in a database from before the kind field: switch on, no kind (or the old "goods" default). */
async function legacyCategory(slug: string, kind: string | null, fields: unknown[] = []) {
  const doc: Record<string, unknown> = { slug, name: slug, enabled: true, fields, videoTourEnabled: true, videoTourCoins: 1 };
  if (kind !== null) doc.kind = kind;
  const { insertedId } = await Category.collection.insertOne(doc);
  return String(insertedId);
}

async function adIn(categoryId: string) {
  const listing = await Listing.create({
    ownerId: new mongoose.Types.ObjectId(),
    categoryId: new mongoose.Types.ObjectId(categoryId),
    status: "active",
    title: "Hello there",
    description: "A description that is long enough",
    publishedAt: new Date(),
  });
  return String(listing._id);
}

async function hold(listingId: string) {
  const user = uid();
  await creditWallet({ userId: user, amount: 3, refType: "test", refId: "seed", requestId: req });
  await expect(holdInEscrow({ userId: user, vendorId: uid(), coins: 1, bookingId: `b-${uid()}`, listingId, requestId: req })).rejects.toThrow();
  expect(await walletBalance(user)).toBe(3);
}

describe("existing people categories are repaired before any tour can start", () => {
  it("a dating category stored with the old default kind and its switch on gets 403 from holdInEscrow after the repair", async () => {
    const categoryId = await legacyCategory("dating", "goods");
    const listingId = await adIn(categoryId);
    await repairCategoryKinds();
    const category = await Category.findById(categoryId).lean();
    expect(category?.kind).toBe("people");
    expect(category?.videoTourEnabled).toBe(false);
    const user = uid();
    await creditWallet({ userId: user, amount: 3, refType: "test", refId: "seed", requestId: req });
    const attempt = holdInEscrow({ userId: user, vendorId: uid(), coins: 1, bookingId: `b-${uid()}`, listingId, requestId: req });
    await expect(attempt).rejects.toThrow("Not available for people listings");
    await expect(attempt).rejects.toMatchObject({ status: 403 });
    expect(await walletBalance(user)).toBe(3);
  });

  it("a dating category with no kind at all is also made people, not left open", async () => {
    const categoryId = await legacyCategory("dating", null);
    const listingId = await adIn(categoryId);
    await repairCategoryKinds();
    await hold(listingId);
    expect((await Category.findById(categoryId).lean())?.kind).toBe("people");
  });

  it("a category with an age-gate field (min 18) is made people even under a new slug", async () => {
    const categoryId = await legacyCategory("companions-new", "goods", [{ key: "age", min: 18, type: "number" }]);
    await repairCategoryKinds();
    expect((await Category.findById(categoryId).lean())?.kind).toBe("people");
  });

  it("an ordinary category without a kind is listed for an admin, not guessed", async () => {
    await legacyCategory("mystery-shop", null);
    const result = await repairCategoryKinds();
    expect(result.withoutKind).toContain("mystery-shop");
  });

  it("running the repair again changes nothing", async () => {
    await legacyCategory("dating", "goods");
    await repairCategoryKinds();
    const second = await repairCategoryKinds();
    expect(second.updated).toBe(0);
  });
});

describe("new categories must choose a kind", () => {
  const actor = { email: "", roles: ["admin"] };

  it("refuses a create without a kind", async () => {
    await expect(createCategory(actor, { name: "Gadgets", slug: "gadgets" })).rejects.toThrow("Choose a kind");
    expect(await Category.countDocuments({ slug: "gadgets" })).toBe(0);
  });

  it("creates the category with the kind the admin chose, and never with live tours on", async () => {
    await createCategory(actor, { name: "Gadgets", slug: "gadgets", kind: "goods" });
    const doc = await Category.findOne({ slug: "gadgets" }).lean();
    expect(doc?.kind).toBe("goods");
    expect(doc?.videoTourEnabled).toBe(false);
  });
});

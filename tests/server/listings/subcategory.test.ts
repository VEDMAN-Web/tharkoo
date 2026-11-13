import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
import { dryRunImport, runImport, type ImportActor } from "@/server/listings/import";
import { createDraft, patchListing } from "@/server/listings/service";
import { Category, Listing, Location, User } from "@/server/models";
import { Subcategory } from "@/server/models/subcategory";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: ImportActor = { id: new Types.ObjectId().toString(), roles: ["admin"] };
const REQ = "req-sub";

async function user(email = "owner@example.com") {
  return User.create({
    email,
    passwordHash: "not-a-secret",
    displayName: "Owner",
    dateOfBirth: new Date("1990-04-02"),
    attestedAdultAt: new Date("2020-01-01"),
    roles: ["user"],
    verificationStatus: "approved",
    status: "active",
  });
}

async function category(slug: string) {
  return Category.create({ slug, name: slug, enabled: true, fields: [] });
}

async function sub(categoryId: Types.ObjectId, slug: string, enabled = true) {
  return Subcategory.create({ categoryId, slug, name: slug[0].toUpperCase() + slug.slice(1), enabled });
}

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

describe("listing sub-category", () => {
  it("saves a visible sub-category of the chosen category and returns it", async () => {
    const owner = await user();
    const cat = await category("services");
    const plumbers = await sub(cat._id, "plumbers");
    const draft = await createDraft(owner.id, { categoryId: cat.id, subcategoryId: plumbers.id }, REQ);
    expect(draft.subcategoryId).toBe(plumbers.id);
    expect((await Listing.findById(draft.id).lean())?.subcategoryId?.toString()).toBe(plumbers.id);
  });

  it("rejects a sub-category from another category or a hidden one", async () => {
    const owner = await user();
    const services = await category("services");
    const cycles = await category("cycles");
    await sub(services._id, "plumbers");
    const foreign = await sub(cycles._id, "road");
    const hidden = await sub(services._id, "retired", false);
    await expect(createDraft(owner.id, { categoryId: services.id, subcategoryId: foreign.id }, REQ)).rejects.toThrow();
    await expect(createDraft(owner.id, { categoryId: services.id, subcategoryId: hidden.id }, REQ)).rejects.toThrow();
    await expect(createDraft(owner.id, { categoryId: services.id, subcategoryId: "nope" }, REQ)).rejects.toThrow();
    expect(await Listing.countDocuments({})).toBe(0);
  });

  it("requires one on create and on a basics update when the category has visible sub-categories", async () => {
    const owner = await user();
    const services = await category("services");
    const cycles = await category("cycles");
    const plumbers = await sub(services._id, "plumbers");
    await expect(createDraft(owner.id, { categoryId: services.id }, REQ)).rejects.toThrow(/Invalid request/);
    const plain = await createDraft(owner.id, { categoryId: cycles.id }, REQ);
    await expect(patchListing(plain.id as string, owner.id, { stage: "basics", categoryId: services.id }, REQ)).rejects.toThrow(
      /Invalid request/,
    );
    const moved = await patchListing(
      plain.id as string,
      owner.id,
      { stage: "basics", categoryId: services.id, subcategoryId: plumbers.id },
      REQ,
    );
    expect(moved.subcategoryId).toBe(plumbers.id);
    const road = await sub(cycles._id, "road");
    await expect(patchListing(plain.id as string, owner.id, { stage: "basics", subcategoryId: road.id }, REQ)).rejects.toThrow();
  });

  it("drops the old sub-category when the category changes to one with none", async () => {
    const owner = await user();
    const services = await category("services");
    const cycles = await category("cycles");
    const plumbers = await sub(services._id, "plumbers");
    const draft = await createDraft(owner.id, { categoryId: services.id, subcategoryId: plumbers.id }, REQ);
    const moved = await patchListing(draft.id as string, owner.id, { stage: "basics", categoryId: cycles.id }, REQ);
    expect(moved.subcategoryId).toBeNull();
  });

  it("saves without one in a category that has none, and old listings keep working when sub-categories are added later", async () => {
    const owner = await user();
    const cycles = await category("cycles");
    const draft = await createDraft(owner.id, { categoryId: cycles.id }, REQ);
    expect(draft.subcategoryId).toBeNull();
    const renamed = await patchListing(draft.id as string, owner.id, { stage: "basics", title: "New title here" }, REQ);
    expect(renamed.title).toBe("New title here");
    await sub(cycles._id, "road");
    const again = await patchListing(draft.id as string, owner.id, { stage: "basics", title: "Another title" }, REQ);
    expect(again.title).toBe("Another title");
  });
});

describe("CSV import sub-category column", () => {
  async function setup() {
    const owner = await user("broker@example.com");
    const cat = await category("cycles");
    await sub(cat._id, "road-bikes");
    const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", enabled: true });
    await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true });
    return owner;
  }
  const head = "category,city,subcategory,title,description";

  it("resolves a sub-category by name or slug and imports the row with it", async () => {
    const owner = await setup();
    const csv = [
      head,
      "cycles,surat,road-BIKES,Hero road cycle,A well kept cycle",
      "cycles,surat,road-bikes,Second road cycle,Also well kept",
    ].join("\n");
    const dry = await dryRunImport(admin, owner.email, csv);
    expect(dry.okCount).toBe(2);
    const result = await runImport(admin, owner.email, csv, "pending", REQ);
    expect(result.imported).toBe(2);
    const rows = await Listing.find({}).lean();
    expect(rows.every((row) => row.subcategoryId)).toBe(true);
  });

  it("marks an unknown or blank sub-category as an error row", async () => {
    const owner = await setup();
    const csv = [
      head,
      "cycles,surat,Unicycles,Odd cycle here,A well kept cycle",
      "cycles,surat,,Blank cycle here,A well kept cycle",
    ].join("\n");
    const dry = await dryRunImport(admin, owner.email, csv);
    expect(dry.okCount).toBe(0);
    expect(dry.rows[0].errors.join(" ")).toMatch(/Unknown subcategory/);
    expect(dry.rows[1].errors.join(" ")).toMatch(/subcategory/);
    expect((await runImport(admin, owner.email, csv, "pending", REQ)).imported).toBe(0);
  });
});

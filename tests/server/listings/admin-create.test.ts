import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const queueIndexNow = vi.hoisted(() => vi.fn());
vi.mock("@/server/indexnow/ping", () => ({ queueIndexNow }));
import { createAdminAd, adPhotoLimit, type AdminAdInput } from "@/server/listings/admin-create";
import { createPlace } from "@/server/locations/manage";
import { AuditEvent, Category, Listing, Location, MediaAsset, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const staffRoles = { admin: ["admin"], superadmin: ["superadmin"] } as const;

async function account(email: string, roles: string[] = ["user"]) {
  return User.create({
    email,
    passwordHash: "not-a-secret",
    displayName: email.split("@")[0],
    dateOfBirth: new Date("1990-04-02"),
    attestedAdultAt: new Date("2020-01-01"),
    roles,
    verificationStatus: "approved",
    status: "active",
  });
}

async function catalogue(importMaxPhotos: number | null = null) {
  const category = await Category.create({
    slug: "cycles",
    name: "Cycles",
    enabled: true,
    importMaxPhotos,
    fields: [
      { key: "amount", label: "Amount", type: "number", required: true, min: 0, order: 1, enabled: true },
      { key: "condition", label: "Condition", type: "select", options: ["new", "used"], required: false, order: 2, enabled: true },
    ],
  });
  const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", enabled: true });
  const city = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true });
  return { category, state, city };
}

async function photos(ownerId: mongoose.Types.ObjectId, count: number) {
  const rows = await MediaAsset.insertMany(
    Array.from({ length: count }, (_, index) => ({
      ownerId,
      kind: "image",
      objectKey: `/uploads/photo-${index}.jpg`,
      status: "cleared",
      clearedAt: new Date(),
      contentType: "image/jpeg",
    })),
  );
  return rows.map((row) => row._id.toString());
}

function adInput(over: Partial<AdminAdInput>): AdminAdInput {
  return {
    ownerEmail: "",
    categoryId: "",
    cityId: "",
    title: "Used bicycle for sale",
    description: "A well kept cycle for daily use",
    price: 4500,
    attributes: { amount: 4500, condition: "used" },
    photoIds: [],
    videoIds: [],
    status: "pending",
    ...over,
  };
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
  queueIndexNow.mockClear();
});

describe("adPhotoLimit", () => {
  it("uses the category maximum, or 10 when there is none", () => {
    expect(adPhotoLimit(4)).toBe(4);
    expect(adPhotoLimit(null)).toBe(10);
    expect(adPhotoLimit(undefined)).toBe(10);
  });
});

describe("createAdminAd", () => {
  it("posts for a chosen user, sends to moderation, and audits the staff actor and the owner", async () => {
    const staff = await account("staff@example.com", ["admin"]);
    const owner = await account("broker@example.com");
    const { category, city } = await catalogue();
    const actor = { id: staff._id.toString(), roles: staffRoles.admin.slice() };

    const created = await createAdminAd(
      actor,
      adInput({ ownerEmail: "broker@example.com", categoryId: category._id.toString(), cityId: city._id.toString() }),
      "req-1",
    );

    expect(created.status).toBe("pending");
    expect(created.ownerId).toBe(owner._id.toString());
    const listing = await Listing.findById(created.id).lean();
    expect(listing?.ownerId.toString()).toBe(owner._id.toString());
    expect(listing?.status).toBe("pending");
    const audit = await AuditEvent.findOne({ action: "listing.admin_create" }).lean();
    expect(audit?.actorId?.toString()).toBe(staff._id.toString());
    expect((audit?.after as Record<string, unknown>).ownerId).toBe(owner._id.toString());
  });

  it("posts as the staff account when no email is given", async () => {
    const staff = await account("staff@example.com", ["admin"]);
    const { category, city } = await catalogue();

    const created = await createAdminAd({ id: staff._id.toString(), roles: ["admin"] }, adInput({ categoryId: category._id.toString(), cityId: city._id.toString() }), "req-2");

    expect(created.ownerId).toBe(staff._id.toString());
  });

  it("refuses an admin who asks to publish now", async () => {
    const staff = await account("staff@example.com", ["admin"]);
    const { category, city } = await catalogue();

    await expect(
      createAdminAd({ id: staff._id.toString(), roles: ["admin"] }, adInput({ status: "active", categoryId: category._id.toString(), cityId: city._id.toString() }), "req-3"),
    ).rejects.toThrow(/superadmin/i);
  });

  it("lets a superadmin publish now", async () => {
    const boss = await account("boss@example.com", ["superadmin"]);
    const { category, city } = await catalogue();

    const created = await createAdminAd({ id: boss._id.toString(), roles: ["superadmin"] }, adInput({ status: "active", categoryId: category._id.toString(), cityId: city._id.toString() }), "req-4");

    expect(created.status).toBe("active");
    expect((await Listing.findById(created.id).lean())?.status).toBe("active");
  });

  it("refuses a non-staff role", async () => {
    const plain = await account("plain@example.com");
    const { category, city } = await catalogue();

    await expect(
      createAdminAd({ id: plain._id.toString(), roles: ["user"] }, adInput({ categoryId: category._id.toString(), cityId: city._id.toString() }), "req-5"),
    ).rejects.toThrow(/admin or a superadmin/i);
  });

  it("takes the photo limit from the category", async () => {
    const staff = await account("staff@example.com", ["admin"]);
    const { category, city } = await catalogue(2);
    const actor = { id: staff._id.toString(), roles: ["admin"] };
    const base = { categoryId: category._id.toString(), cityId: city._id.toString() };
    const three = await photos(staff._id, 3);

    await expect(createAdminAd(actor, adInput({ ...base, photoIds: three }), "req-6")).rejects.toThrow(/limit for this category is 2/);

    const two = await photos(staff._id, 2);
    const created = await createAdminAd(actor, adInput({ ...base, photoIds: two }), "req-7");
    expect((await Listing.findById(created.id).lean())?.mediaIds).toHaveLength(2);
  });

  it("uses a city that was added on the fly under the chosen state", async () => {
    const staff = await account("staff@example.com", ["admin"]);
    const { category, state } = await catalogue();
    const actor = { email: "staff@example.com", roles: ["admin"] };

    const added = await createPlace(actor, { type: "city", parentId: state._id.toString(), name: "Navsari" });
    const created = await createAdminAd({ id: staff._id.toString(), roles: ["admin"] }, adInput({ categoryId: category._id.toString(), cityId: added.id }), "req-8");

    const listing = await Listing.findById(created.id).lean();
    expect(listing?.cityId?.toString()).toBe(added.id);
    const audit = await AuditEvent.findOne({ action: "location.create" }).lean();
    expect(audit?.actorType).toBe("admin");
  });

  it("refuses a city that is not in Locations", async () => {
    const staff = await account("staff@example.com", ["admin"]);
    const { category } = await catalogue();

    await expect(
      createAdminAd({ id: staff._id.toString(), roles: ["admin"] }, adInput({ categoryId: category._id.toString(), cityId: new mongoose.Types.ObjectId().toString() }), "req-9"),
    ).rejects.toThrow(/Choose a city/);
  });
});

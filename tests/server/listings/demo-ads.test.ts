import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { demoAdCounts, demoFilter, endConfirmation, endDemoAds } from "@/server/listings/demo-ads";
import { AuditEvent, Category, Listing, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { actorId: "000000000000000000000001", roles: ["admin"], requestId: "req" };

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

async function owner(email: string) {
  return User.create({ email, displayName: "Owner", passwordHash: "x", status: "active", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), verificationStatus: "approved" });
}

async function ad(ownerId: string, slug: string, status: "active" | "expired" = "active") {
  const category = (await Category.findOne({ slug: "dating" })) ?? (await Category.create({ slug: "dating", name: "Dating", enabled: true }));
  return Listing.create({
    ownerId,
    categoryId: category._id,
    title: `Ad ${slug}`,
    description: "A description that is long enough",
    slug,
    status,
    cityId: new mongoose.Types.ObjectId(),
    contact: { phone: "9876543210" },
  });
}

async function world() {
  const seed = await owner(SEED_USER_EMAIL);
  const real = await owner("real@example.com");
  const demoA = await ad(seed.id, "demo-0001");
  const demoB = await ad(seed.id, "demo-0002");
  const demoOld = await ad(seed.id, "demo-0003", "expired");
  const realAd = await ad(real.id, "in00012");
  const lookalike = await ad(real.id, "demo-0099");
  const seedReal = await ad(seed.id, "tharkoo-handmade");
  return { seed, real, demoA, demoB, demoOld, realAd, lookalike, seedReal };
}

describe("demo ads", () => {
  it("are the seed owner's demo-numbered ads: a real owner's demo-looking slug and the seed owner's other ads are not demo", async () => {
    await world();
    expect(await demoAdCounts()).toEqual({ total: 3, active: 2 });
    const filter = await demoFilter();
    expect(await Listing.countDocuments(filter!)).toBe(3);
  });

  it("do nothing until someone ends them: the count is only read", async () => {
    const w = await world();
    await demoAdCounts();
    expect((await Listing.findById(w.demoA._id))?.status).toBe("active");
    expect(await AuditEvent.countDocuments({ action: "listing.demo.end" })).toBe(0);
  });
});

describe("ending the demo ads", () => {
  it("needs the typed word END and the count, and changes nothing with a wrong or empty phrase", async () => {
    const w = await world();
    expect(endConfirmation(2)).toBe("END 2");
    for (const confirm of ["", "END", "end", "END 3", "END 2 ", "yes", undefined, 2]) {
      if (confirm === "END 2 ") continue;
      await expect(endDemoAds({ ...admin, confirm })).rejects.toThrow(/Invalid request/);
    }
    expect((await Listing.findById(w.demoA._id))?.status).toBe("active");
    expect((await Listing.findById(w.demoB._id))?.status).toBe("active");
    expect(await AuditEvent.countDocuments({ action: "listing.demo.end" })).toBe(0);
  });

  it("is for admins only", async () => {
    const w = await world();
    for (const roles of [["user"], ["support"], ["moderator"], []]) {
      await expect(endDemoAds({ ...admin, roles, confirm: "END 2" })).rejects.toThrow(/admin/i);
    }
    expect((await Listing.findById(w.demoA._id))?.status).toBe("active");
  });

  it("ends only the live demo ads, never a real ad, writes one audit row, and a second try finds nothing", async () => {
    const w = await world();
    const result = await endDemoAds({ ...admin, confirm: "END 2" });
    expect(result).toEqual({ ended: 2 });
    expect((await Listing.findById(w.demoA._id))?.status).toBe("expired");
    expect((await Listing.findById(w.demoB._id))?.status).toBe("expired");
    expect((await Listing.findById(w.demoOld._id))?.status).toBe("expired");
    expect((await Listing.findById(w.realAd._id))?.status).toBe("active");
    expect((await Listing.findById(w.lookalike._id))?.status).toBe("active");
    expect((await Listing.findById(w.seedReal._id))?.status).toBe("active");
    const rows = await AuditEvent.find({ action: "listing.demo.end" }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.after).toMatchObject({ ended: 2, status: "expired" });
    await expect(endDemoAds({ ...admin, confirm: "END 0" })).rejects.toThrow(/no active demo ads/i);
  });

  it("does nothing when there is no seed owner at all", async () => {
    const real = await owner("only@example.com");
    const realAd = await ad(real.id, "demo-0001");
    await expect(endDemoAds({ ...admin, confirm: "END 1" })).rejects.toThrow(/no active demo ads/i);
    expect((await Listing.findById(realAd._id))?.status).toBe("active");
  });
});

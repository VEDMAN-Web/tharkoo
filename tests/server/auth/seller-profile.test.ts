import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { normalizeWhatsapp, saveSellerProfile, sellerProfileBodySchema } from "@/server/auth/seller-profile";
import { createCodeAccount } from "@/server/auth/service";
import { ValidationError, VerificationRequiredError } from "@/server/http";
import { AuditEvent, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const adult = "1990-05-01";
const minor = "2015-05-01";

function body(overrides: Record<string, unknown> = {}) {
  return sellerProfileBodySchema.parse({
    name: "Asha Traders",
    city: "Surat",
    whatsapp: "",
    availableNow: true,
    dateOfBirth: adult,
    adultConfirmed: true,
    ...overrides,
  });
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.SESSION_SECRET = "session-secret";
  await connectMemoryMongo();
  await User.init();
});

afterAll(async () => {
  delete process.env.SESSION_SECRET;
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
});

describe("seller profile input", () => {
  it("normalises WhatsApp to digits with an optional plus, and refuses a short number", () => {
    expect(normalizeWhatsapp("")).toBeNull();
    expect(normalizeWhatsapp("+91 98250 12345")).toBe("+919825012345");
    expect(normalizeWhatsapp("098250-12345")).toBe("09825012345");
    expect(normalizeWhatsapp("1234")).toBeNull();
  });

  it("rejects unknown fields", () => {
    expect(sellerProfileBodySchema.safeParse({ name: "Asha", city: "Surat", role: "admin" }).success).toBe(false);
  });
});

describe("seller profile (H7.2b)", () => {
  it("creates a code account with no password, then saves the profile with date of birth and the 18+ tick", async () => {
    const created = await createCodeAccount("seller@example.com");
    expect(created.passwordHash).toBeUndefined();
    const result = await saveSellerProfile({ userId: created.id, body: body({ whatsapp: "+91 98250 12345" }), requestId: "t-sp-1" });
    expect(result.seller).toEqual({ name: "Asha Traders", city: "Surat", whatsapp: "+919825012345", availableNow: true });

    const stored = await User.findById(created._id).lean();
    expect(stored?.displayName).toBe("Asha Traders");
    expect(stored?.dateOfBirth).toBeInstanceOf(Date);
    expect(stored?.attestedAdultAt).toBeInstanceOf(Date);
    expect(await AuditEvent.countDocuments({ action: "auth.seller_profile.save", targetId: String(created._id) })).toBe(1);
  });

  it("never returns the date of birth in the seller view or the signed-in user", async () => {
    const created = await createCodeAccount("private-dob@example.com");
    const result = await saveSellerProfile({ userId: created.id, body: body(), requestId: "t-sp-2" });
    expect(Object.keys(result.seller)).not.toContain("dateOfBirth");
    expect(JSON.stringify(result)).not.toContain(adult);
  });

  it("refuses anyone under 18 and writes nothing", async () => {
    const created = await createCodeAccount("minor@example.com");
    await expect(saveSellerProfile({ userId: created.id, body: body({ dateOfBirth: minor }), requestId: "t-sp-3" })).rejects.toBeInstanceOf(
      VerificationRequiredError,
    );
    const stored = await User.findById(created._id).lean();
    expect(stored?.dateOfBirth).toBeUndefined();
    expect(stored?.sellerProfile).toBeUndefined();
  });

  it("needs the 18+ tick together with the date of birth", async () => {
    const created = await createCodeAccount("no-tick@example.com");
    await expect(saveSellerProfile({ userId: created.id, body: body({ adultConfirmed: false }), requestId: "t-sp-4" })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveSellerProfile({ userId: created.id, body: body({ dateOfBirth: undefined }), requestId: "t-sp-4b" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("asks for the date of birth once: a later change does not move it", async () => {
    const created = await createCodeAccount("once@example.com");
    await saveSellerProfile({ userId: created.id, body: body(), requestId: "t-sp-5" });
    const first = await User.findById(created._id).lean();
    await saveSellerProfile({ userId: created.id, body: body({ name: "Asha Stores", dateOfBirth: "1991-01-01", city: "Mumbai" }), requestId: "t-sp-6" });
    const second = await User.findById(created._id).lean();
    expect(second?.dateOfBirth?.toISOString()).toBe(first?.dateOfBirth?.toISOString());
    expect(second?.sellerProfile?.name).toBe("Asha Stores");
    expect(second?.sellerProfile?.city).toBe("Mumbai");
    expect(second?.sellerProfile?.completedAt?.toISOString()).toBe(first?.sellerProfile?.completedAt?.toISOString());
  });

  it("refuses an invalid WhatsApp number", async () => {
    const created = await createCodeAccount("wa@example.com");
    await expect(saveSellerProfile({ userId: created.id, body: body({ whatsapp: "12" }), requestId: "t-sp-7" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("staff keep their password and age fields", () => {
  it("a staff account without a password is refused by the model", async () => {
    await expect(
      User.create({ email: "staff-no-pass@example.com", displayName: "Staff", roles: ["moderator"], verificationStatus: "approved", status: "active" }),
    ).rejects.toThrow();
  });

  it("a user without a password is accepted by the model", async () => {
    await expect(createCodeAccount("plain-user@example.com")).resolves.toBeTruthy();
  });
});

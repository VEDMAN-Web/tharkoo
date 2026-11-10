import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser, stagingAutoVerifyDecision } from "@/server/auth/service";
import { User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

function resetDbCache() {
  const globalForMongo = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (globalForMongo.mongoose) {
    globalForMongo.mongoose.conn = null;
    globalForMongo.mongoose.promise = null;
  }
}

const person = {
  password: "password123",
  displayName: "Ada",
  dateOfBirth: "1995-04-02",
  acceptedTerms: true,
  attestedAdult: true,
} as const;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  resetDbCache();
  await connectMemoryMongo();
  const globalForMongo = globalThis as { mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } };
  globalForMongo.mongoose = { conn: mongoose, promise: Promise.resolve(mongoose) };
});

afterAll(async () => {
  delete process.env.STAGING_AUTO_VERIFY_EMAIL;
  delete process.env.SITE_NOINDEX;
  await disconnectMemoryMongo();
  resetDbCache();
});

beforeEach(async () => {
  await clearMemoryMongo();
  delete process.env.STAGING_AUTO_VERIFY_EMAIL;
  delete process.env.SITE_NOINDEX;
});

describe("staging auto-verify", () => {
  it("refuses the flag unless the site is noindex", () => {
    process.env.STAGING_AUTO_VERIFY_EMAIL = "true";
    process.env.SITE_NOINDEX = "false";
    expect(() => stagingAutoVerifyDecision()).toThrow(/SITE_NOINDEX/);
    delete process.env.SITE_NOINDEX;
    expect(() => stagingAutoVerifyDecision()).toThrow(/SITE_NOINDEX/);
  });

  it("marks email verified at register only when both flags are true", async () => {
    process.env.STAGING_AUTO_VERIFY_EMAIL = "true";
    process.env.SITE_NOINDEX = "true";
    const created = await registerUser({ ...person, email: "ada@example.com" });
    const user = await User.findById(created.userId);
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);

    delete process.env.STAGING_AUTO_VERIFY_EMAIL;
    const plain = await registerUser({ ...person, email: "bea@example.com" });
    const unverified = await User.findById(plain.userId);
    expect(unverified?.emailVerifiedAt).toBeFalsy();
  });
});

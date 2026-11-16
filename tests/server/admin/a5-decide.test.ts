import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/server/http";
import { approveListing } from "@/server/moderation/decide";
import { connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

async function outcome(roles: string[]) {
  try {
    await approveListing({ id: new mongoose.Types.ObjectId().toString(), roles, email: "staff@example.com" });
    return "decided";
  } catch (error) {
    if (error instanceof ForbiddenError) return "forbidden";
    if (error instanceof NotFoundError) return "allowed";
    throw error;
  }
}

describe("who may decide on ads (A5)", () => {
  it("moderators, trust and safety, and admins may; every other role may not", async () => {
    for (const role of ["moderator", "trust_safety", "admin", "superadmin"]) expect(await outcome([role]), role).toBe("allowed");
    for (const role of ["support", "finance", "seo_editor", "blog_editor", "user"]) expect(await outcome([role]), role).toBe("forbidden");
    expect(await outcome([])).toBe("forbidden");
  });
});

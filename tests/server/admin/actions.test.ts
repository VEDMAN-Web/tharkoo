import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditEvent } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** The viewer the mocked staff check returns; each test sets it before calling an action. */
let viewer = { verified: true, kind: "person", email: "staff@example.com", name: "Staff", roles: ["seo_editor"] };

vi.mock("@/lib/admin-auth", () => ({
  getStaffFromHeaders: async () => viewer,
  isStaff: (identity: { verified: boolean; roles: string[] }) =>
    identity.verified && identity.roles.some((role) => ["support", "moderator", "trust_safety", "seo_editor", "finance", "admin", "superadmin"].includes(role)),
}));

const { adminList, adminMutate } = await import("@/app/admin/actions");

describe("admin server actions check the role themselves", () => {
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
    viewer = { ...viewer, roles: ["seo_editor"] };
  });

  it("refuses an seo_editor who writes a Coupon through adminMutate, and audits it", async () => {
    viewer = { ...viewer, roles: ["seo_editor"] };
    await expect(adminMutate({ model: "Coupon", op: "create", data: { code: "X" } })).rejects.toThrow("Forbidden");
    const audit = await AuditEvent.findOne({ action: "admin.api.denied", targetId: "Coupon" }).lean();
    expect(audit).not.toBeNull();
    expect(audit?.after).toMatchObject({ op: "create", roles: ["seo_editor"] });
  });

  it("lets a moderator list Listing through adminList", async () => {
    viewer = { ...viewer, roles: ["moderator"] };
    const items = await adminList("Listing");
    expect(Array.isArray(items)).toBe(true);
  });

  it("refuses a moderator who lists Coupon", async () => {
    viewer = { ...viewer, roles: ["moderator"] };
    await expect(adminList("Coupon")).rejects.toThrow("Forbidden");
  });

  it("refuses support on every model, for read and write", async () => {
    viewer = { ...viewer, roles: ["support"] };
    await expect(adminList("Listing")).rejects.toThrow("Forbidden");
    await expect(adminList("Coupon")).rejects.toThrow("Forbidden");
    await expect(adminMutate({ model: "SeoTemplate", op: "create", data: {} })).rejects.toThrow("Forbidden");
  });

  it("still lets an admin use a model through the action", async () => {
    viewer = { ...viewer, roles: ["admin"] };
    await expect(adminList("Coupon")).resolves.toBeDefined();
  });
});

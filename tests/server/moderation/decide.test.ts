import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { approveListing, rejectListing } from "@/server/moderation/decide";
import { AuditEvent, Listing } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const mod = { email: "mod@example.test", roles: ["moderator"] };

beforeAll(async () => {
  await connectMemoryMongo();
});
beforeEach(clearMemoryMongo);
afterAll(disconnectMemoryMongo);

async function ad(status: "pending" | "active" = "pending") {
  const row = await Listing.create({
    ownerId: new mongoose.Types.ObjectId(),
    status,
    categoryId: new mongoose.Types.ObjectId(),
    title: "Used cycle",
    description: "A well kept cycle for sale",
  });
  return row._id.toString();
}

describe("moderation decisions", () => {
  it("approves a pending ad: live, indexable, slug, expiry, audited", async () => {
    const id = await ad();
    await approveListing({ id, ...mod });
    const row = await Listing.findById(id).lean();
    expect(row?.status).toBe("active");
    expect(row?.slug).toBe("used-cycle");
    expect(row?.seoNoindex).toBe(false);
    expect(row?.expiresAt).toBeTruthy();
    expect(await AuditEvent.countDocuments({ action: "listing.approve", targetId: id })).toBe(1);
  });

  it("rejects a pending ad with a reason and audits it", async () => {
    const id = await ad();
    await expect(rejectListing({ id, ...mod, reason: "  " })).rejects.toThrow(/reason/i);
    await rejectListing({ id, ...mod, reason: "Photos do not match the text" });
    expect((await Listing.findById(id).lean())?.status).toBe("rejected");
    const event = await AuditEvent.findOne({ action: "listing.reject", targetId: id }).lean();
    expect(event?.reason).toBe("Photos do not match the text");
  });

  it("refuses ads that are not pending and users who are not moderators", async () => {
    const live = await ad("active");
    await expect(approveListing({ id: live, ...mod })).rejects.toThrow(/not waiting/i);
    const id = await ad();
    for (const roles of [["user"], ["seo_editor"], []]) {
      await expect(approveListing({ id, email: "x@example.test", roles })).rejects.toThrow(/moderator/i);
    }
    expect((await Listing.findById(id).lean())?.status).toBe("pending");
  });
});

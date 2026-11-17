import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAdminCounts } from "@/server/admin/counts";
import { listReports } from "@/server/admin/reports";
import { Listing, Report, User } from "@/server/models";
import { connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const oid = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  const owner = await User.create({ email: "seller@example.test", displayName: "Riya", roles: ["user"], status: "active" });
  const ad = async (title: string) => (await Listing.create({ ownerId: owner._id, status: "active", categoryId: oid(), title, description: "A description that is long enough", publishedAt: new Date() }))._id;
  const first = await ad("Fake photos");
  const second = await ad("Wrong price");
  const legal = await ad("Photo used without consent");
  const closed = await ad("Old one");
  const base = { reason: "fake", severity: "S3", details: "x" };
  await Report.insertMany([
    { ...base, listingId: first, status: "open" },
    { ...base, listingId: first, status: "ack" },
    { ...base, listingId: second, status: "open" },
    { ...base, listingId: legal, status: "open", source: "legal", severity: "S2" },
    { ...base, listingId: closed, status: "dismissed" },
  ] as never);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("the sidebar Reports number", () => {
  it("counts ads with open reports, not single reports, and equals the Open tab plus the Legal tab", async () => {
    const counts = await getAdminCounts(["trust_safety"]);
    const screen = await listReports(["trust_safety"], { tab: "open", q: "", page: 1, pageSize: 25 });
    expect(counts.reports).toBe(2);
    expect(counts.legal).toBe(1);
    expect(counts.reports).toBe(screen.counts.open);
    expect(counts.legal).toBe(screen.counts.legal);
    expect((counts.reports ?? 0) + (counts.legal ?? 0)).toBe(screen.counts.open + screen.counts.legal);
  });

  it("shows a moderator the Open number only", async () => {
    const counts = await getAdminCounts(["moderator"]);
    expect(counts.reports).toBe(2);
    expect(counts.legal).toBeUndefined();
  });
});

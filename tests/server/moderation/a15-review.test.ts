import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { getAdminCounts } from "@/server/admin/counts";
import { ConflictError, ForbiddenError } from "@/server/http";
import { getReviewDetail, listReviewTab, markChecked, parseReviewQuery, reviewCounts } from "@/server/moderation/review";
import { AuditEvent, Listing, MediaAsset, Site, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const oid = () => new mongoose.Types.ObjectId();
const AGO = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const admin: AdminCtx = { actorId: String(oid()), email: "admin@example.test", roles: ["admin"], requestId: "r" };
const ADMIN = ["admin"];

async function ad(ownerId: mongoose.Types.ObjectId, slug: string, extra: Record<string, unknown> = {}) {
  return Listing.create({ ownerId, categoryId: oid(), title: `Ad ${slug}`, description: "A description that is long enough", slug, status: "active", publishedAt: new Date(), ...extra });
}

let liveId = "";
let editedId = "";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  const seed = await User.create({ email: SEED_USER_EMAIL, displayName: "Seed", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
  const real = await User.create({ email: "real@example.test", displayName: "Real Seller", roles: ["user"] });
  await Site.create({ key: "main", postModerationSince: AGO(60 * 24) });
  await ad(seed._id, "demo-0001", { status: "pending" });
  await ad(seed._id, "demo-0002", { publishedAt: AGO(60) });
  await ad(real._id, "held-one", { status: "pending" });
  await ad(real._id, "held-two", { status: "pending" });
  liveId = String((await ad(real._id, "live-new", { publishedAt: AGO(120) }))._id);
  await ad(real._id, "live-newer", { publishedAt: AGO(60) });
  await ad(real._id, "live-checked", { publishedAt: AGO(60), lastModerationAt: new Date() });
  await ad(real._id, "live-old", { publishedAt: AGO(60 * 72) });
  const waiting = await ad(real._id, "live-photo", { publishedAt: AGO(60 * 72), lastModerationAt: new Date() });
  editedId = String(waiting._id);
  await MediaAsset.collection.insertOne({ ownerId: real._id, listingId: waiting._id, kind: "image", objectKey: "ads/a.jpg", status: "scanning" });
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

const titles = async (tab: "live" | "held" | "edited") => (await listReviewTab(ADMIN, { tab, q: "", page: 1, pageSize: 25 })).rows.map((row) => row.title);

describe("tab filters", () => {
  it("parses the address with safe defaults", () => {
    expect(parseReviewQuery({})).toEqual({ tab: "live", q: "", page: 1, pageSize: 25 });
    expect(parseReviewQuery({ tab: "held", q: " x ", page: "3", size: "50" })).toEqual({ tab: "held", q: "x", page: 3, pageSize: 50 });
    expect(parseReviewQuery({ tab: "nope", page: "-2", size: "7" })).toEqual({ tab: "live", q: "", page: 1, pageSize: 25 });
  });

  it("Live, not checked: live ads published after the cut-over that nobody checked, oldest first, never demo", async () => {
    expect(await titles("live")).toEqual(["Ad live-new", "Ad live-newer"]);
  });

  it("Held by rules: pending ads, never demo", async () => {
    expect(await titles("held")).toEqual(["Ad held-one", "Ad held-two"]);
  });

  it("Edited, photos waiting: live ads with a photo still being checked", async () => {
    expect(await titles("edited")).toEqual(["Ad live-photo"]);
  });

  it("lists nothing under Live, not checked until the cut-over date is set", async () => {
    await Site.updateOne({ key: "main" }, { $set: { postModerationSince: null } });
    expect(await titles("live")).toEqual([]);
    expect((await listReviewTab(ADMIN, { tab: "live", q: "", page: 1, pageSize: 25 })).liveCheckOn).toBe(false);
    await Site.updateOne({ key: "main" }, { $set: { postModerationSince: AGO(60 * 24) } });
    expect((await listReviewTab(ADMIN, { tab: "live", q: "", page: 1, pageSize: 25 })).liveCheckOn).toBe(true);
  });

  it("search narrows the list by title", async () => {
    const found = await listReviewTab(ADMIN, { tab: "live", q: "newer", page: 1, pageSize: 25 });
    expect(found.rows.map((row) => row.title)).toEqual(["Ad live-newer"]);
    expect(found.total).toBe(1);
  });

  it("the tab counts match the lists and the sidebar counts", async () => {
    const counts = await reviewCounts();
    expect(counts).toEqual({ live: 2, held: 2, edited: 1 });
    const sidebar = await getAdminCounts(ADMIN);
    expect([sidebar.reviewLive, sidebar.reviewHeld, sidebar.reviewEdited]).toEqual([counts.live, counts.held, counts.edited]);
  });

  it("refuses a role that cannot review", async () => {
    await expect(listReviewTab(["support"], { tab: "live", q: "", page: 1, pageSize: 25 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getReviewDetail(["finance"], liveId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("the detail shows the seller and the changes since the last approved version", async () => {
    const detail = await getReviewDetail(ADMIN, editedId);
    expect(detail).toMatchObject({ title: "Ad live-photo", seller: "Real Seller", status: "active" });
    expect(detail.changes).toEqual([]);
  });
});

describe("markChecked", () => {
  it("keeps the ad live, removes it from the list, audits it and drops the count", async () => {
    const before = (await reviewCounts()).live;
    await markChecked(admin, liveId);
    const row = await Listing.findById(liveId).lean();
    expect(row?.status).toBe("active");
    expect(row?.lastModerationAt).toBeTruthy();
    expect(await titles("live")).toEqual(["Ad live-newer"]);
    expect((await reviewCounts()).live).toBe(before - 1);
    const audit = await AuditEvent.findOne({ action: "listing.checked", targetId: liveId }).lean();
    expect(audit).toMatchObject({ targetType: "listing", actorRole: "admin" });
  });

  it("refuses an ad that is not live and a role that cannot review", async () => {
    const held = await Listing.findOne({ slug: "held-one" }).lean();
    await expect(markChecked(admin, String(held?._id))).rejects.toBeInstanceOf(ConflictError);
    await expect(markChecked({ ...admin, roles: ["support"] }, liveId)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { syncAdminIndexes, WANTED } from "../../../scripts/sync-admin-indexes.mjs";
import {
  Category,
  ContentItem,
  ContentRevision,
  IdentityVerification,
  Listing,
  ListingVersion,
  Location,
  PageLayout,
  PageLayoutRevision,
  Payment,
  Session,
  Site,
  SiteMedia,
  User,
  WalletEntry,
} from "@/server/models";
import { STAFF_ROLE_NAMES } from "@/server/models/identity";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const MODELS = [Listing, ListingVersion, Session, User, IdentityVerification, Payment, WalletEntry, ContentItem, ContentRevision];

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await Promise.all(MODELS.map((model) => model.init()));
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
});

describe("A1 schema defaults", () => {
  it("a new Site has every emergency switch off, the undo windows, and the new flags off", async () => {
    const site = await Site.create({ key: "main" });
    expect(site.emergency).toMatchObject({ holdNewAds: false, pauseNewAccounts24h: false, pausePurchases: false, pauseVideoCalls: false, pausePaidPosting: false });
    expect(site.undoWindows).toMatchObject({ edits: 30, decisions: 7, credits: 7, demo: 7, settings: 30 });
    expect(site.homeFromLayout).toBe(false);
    expect(site.listingCopySource).toBe("legacy");
    expect(site.postModerationSince).toBeNull();
    expect(site.launchChecklist?.junkAdsChecked ?? null).toBeNull();
  });

  it("rejects an unknown listing copy source and an undo window of zero", async () => {
    await expect(Site.create({ key: "bad1", listingCopySource: "other" } as never)).rejects.toThrow();
    await expect(Site.create({ key: "bad2", undoWindows: { edits: 0 } })).rejects.toThrow();
  });

  it("a page layout and its revision default to format 1, and accept format 2 only", async () => {
    const layout = await PageLayout.create({ key: "home", scope: "default" });
    expect(layout.format).toBe(1);
    const revision = await PageLayoutRevision.create({ key: "home", scope: "default", version: 1, publishedAt: new Date() });
    expect(revision.format).toBe(1);
    await expect(PageLayout.create({ key: "listing", scope: "x", format: 3 } as never)).rejects.toThrow();
    expect((await PageLayout.create({ key: "post", scope: "default", format: 2 })).format).toBe(2);
  });

  it("site media gets trash and focus fields with safe defaults", async () => {
    const media = await SiteMedia.create({ url: "/a.webp", objectKey: "a", alt: "A", contentType: "image/webp" });
    expect(media.trashedAt).toBeNull();
    expect(media.purgeAfter).toBeNull();
    expect(media.phoneVariantId).toBeNull();
    expect([media.focusX, media.focusY]).toEqual([50, 50]);
    await expect(SiteMedia.create({ url: "/b.webp", objectKey: "b", alt: "B", contentType: "image/webp", focusX: 120 })).rejects.toThrow();
  });

  it("a category and a city carry a photo and a band only when set, with a centred focus", async () => {
    const plain = await Category.create({ slug: "plain", name: "Plain" });
    expect(plain.photo).toBeUndefined();
    expect(plain.band).toBeUndefined();
    const mediaId = new mongoose.Types.ObjectId();
    const set = await Category.create({ slug: "framed", name: "Framed", photo: { mediaId, alt: "A pic" }, band: { mediaId, phoneMediaId: mediaId } });
    expect(set.photo).toMatchObject({ focusX: 50, focusY: 50, alt: "A pic" });
    expect(set.band?.phoneMediaId?.toString()).toBe(mediaId.toString());
    const city = await Location.create({ type: "city", slug: "pune", name: "Pune", photo: { mediaId, focusX: 10, focusY: 90 } });
    expect(city.photo).toMatchObject({ focusX: 10, focusY: 90 });
    await expect(Category.create({ slug: "nomedia", name: "No media", photo: { alt: "x" } })).rejects.toThrow();
  });

  it("a listing can carry the demo-ended marker and it is missing otherwise", async () => {
    const listing = new Listing({ ownerId: new mongoose.Types.ObjectId(), categoryId: new mongoose.Types.ObjectId(), title: "T", description: "D" });
    expect(listing.demoEndedBatch).toBeUndefined();
    listing.demoEndedBatch = "demo-end-1";
    expect(listing.demoEndedBatch).toBe("demo-end-1");
  });

  it("blog_editor and content_editor are staff roles and the other seven still are", () => {
    for (const role of ["admin", "superadmin", "moderator", "trust_safety", "support", "seo_editor", "finance", "blog_editor", "content_editor"]) expect(STAFF_ROLE_NAMES.has(role), role).toBe(true);
    expect(STAFF_ROLE_NAMES.has("user")).toBe(false);
    expect(STAFF_ROLE_NAMES.size).toBe(9);
  });
});

describe("A1 content models", () => {
  it("a content item starts as a draft at version 1 with nothing published", async () => {
    const item = await ContentItem.create({ kind: "blog", slug: "hello" });
    expect(item.status).toBe("draft");
    expect(item.version).toBe(1);
    expect(item.published).toBeNull();
    expect(item.scheduled).toBeNull();
  });

  it("refuses an unknown kind or status, and a second item with the same kind and slug", async () => {
    await expect(ContentItem.create({ kind: "video", slug: "x" } as never)).rejects.toThrow();
    await expect(ContentItem.create({ kind: "blog", slug: "y", status: "live" } as never)).rejects.toThrow();
    await ContentItem.create({ kind: "blog", slug: "same" });
    await expect(ContentItem.create({ kind: "blog", slug: "same" })).rejects.toThrow();
    await ContentItem.create({ kind: "help", slug: "same" });
  });

  it("two listing intros cannot share a path, but items without a path can coexist", async () => {
    await ContentItem.create({ kind: "listingIntro", slug: "a", path: "/dating/pune/" });
    await expect(ContentItem.create({ kind: "listingIntro", slug: "b", path: "/dating/pune/" })).rejects.toThrow();
    await ContentItem.create({ kind: "blog", slug: "no-path-1" });
    await ContentItem.create({ kind: "blog", slug: "no-path-2" });
  });

  it("a revision can be added but never changed or removed, and a version is stored once", async () => {
    const item = await ContentItem.create({ kind: "legal", slug: "terms" });
    const revision = await ContentRevision.create({ itemId: item._id, version: 1, fields: { title: "Terms" }, status: "published", by: "admin" });
    await expect(ContentRevision.updateOne({ _id: revision._id }, { $set: { by: "x" } })).rejects.toThrow(/append-only/);
    await expect(ContentRevision.deleteOne({ _id: revision._id })).rejects.toThrow(/append-only/);
    await expect(ContentRevision.deleteMany({})).rejects.toThrow(/append-only/);
    revision.by = "changed";
    await expect(revision.save()).rejects.toThrow(/append-only/);
    await expect(ContentRevision.create({ itemId: item._id, version: 1, fields: { title: "Terms again" }, status: "draft", by: "admin" })).rejects.toThrow();
    expect(await ContentRevision.countDocuments({ itemId: item._id })).toBe(1);
  });
});

describe("A1 indexes", () => {
  it("every wanted admin index is declared by a schema", async () => {
    const db = mongoose.connection.db!;
    for (const wanted of WANTED) {
      const names = (await db.collection(wanted.collection).indexes()).map((index) => index.name);
      expect(names, `${wanted.collection}.${wanted.name}`).toContain(wanted.name);
    }
  });

  it("the sync script lists nothing missing, then finds, creates and re-checks a dropped index", async () => {
    const db = mongoose.connection.db!;
    const dry = await syncAdminIndexes(db);
    expect(dry).toMatchObject({ apply: false, missing: [], created: [] });
    expect(dry.wanted).toHaveLength(WANTED.length);
    await db.collection("payments").dropIndex("status_1_createdAt_-1");
    await db.collection("content_items").dropIndex("path_1");
    const before = await syncAdminIndexes(db);
    expect(before.missing.sort()).toEqual(["content_items.path_1", "payments.status_1_createdAt_-1"]);
    expect(before.created).toEqual([]);
    expect((await syncAdminIndexes(db)).missing).toHaveLength(2);
    const applied = await syncAdminIndexes(db, { apply: true });
    expect(applied.created.sort()).toEqual(["content_items.path_1", "payments.status_1_createdAt_-1"]);
    expect((await syncAdminIndexes(db, { apply: true })).created).toEqual([]);
    const pathIndex = (await db.collection("content_items").indexes()).find((index) => index.name === "path_1");
    expect(pathIndex).toMatchObject({ unique: true, sparse: true });
  });

  it("reports a repeated listing version pair without changing anything", async () => {
    const db = mongoose.connection.db!;
    const listingId = new mongoose.Types.ObjectId();
    await db.collection("listing_versions").insertMany([
      { listingId, version: 1, snapshot: {}, actorId: listingId },
      { listingId, version: 1, snapshot: {}, actorId: listingId },
    ]);
    const report = await syncAdminIndexes(db);
    expect(report.duplicateVersionPairs).toHaveLength(1);
    expect(await db.collection("listing_versions").countDocuments({ listingId })).toBe(2);
  });
});

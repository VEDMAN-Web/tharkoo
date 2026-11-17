import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { listSiteMedia, uploadSiteMedia } from "@/server/layout/media";
import { getMediaDetail, mediaTabCounts, purgeTrashedMedia, restoreMedia, saveMediaDetails, trashMedia } from "@/server/layout/media-admin";
import { findMediaUsages } from "@/server/layout/media-refs";
import { saveDraft } from "@/server/layout/service";
import { AuditEvent, Banner, Category, Location, SiteMedia } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const seo: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "seo@example.test", roles: ["admin"], requestId: "r" };
const admin = { email: "admin@example.test", roles: ["admin"] };
const DAY_MS = 24 * 60 * 60 * 1000;

function png(width: number, height: number) {
  const head = Buffer.alloc(33);
  head.writeUInt32BE(0x89504e47, 0);
  head.writeUInt32BE(0x0d0a1a0a, 4);
  head.writeUInt32BE(13, 8);
  head.write("IHDR", 12, "ascii");
  head.writeUInt32BE(width, 16);
  head.writeUInt32BE(height, 20);
  return head;
}

let dir = "";

beforeAll(async () => {
  await connectMemoryMongo();
  dir = await mkdtemp(path.join(os.tmpdir(), "site-media-a45-"));
  process.env.SITE_MEDIA_DIR = dir;
});
beforeEach(async () => {
  await clearMemoryMongo();
  for (const name of await readdir(dir)) await rm(path.join(dir, name), { force: true });
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.SITE_MEDIA_DIR;
  await disconnectMemoryMongo();
});

const upload = (alt: string) => uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt, ...admin });
const banner = (item: { id: string; url: string; alt: string }) => ({ type: "banner", visible: true, props: { title: "Hello", image: { assetId: item.id, src: item.url, alt: item.alt, width: 10, height: 10 } } });

describe("the usage registry", () => {
  it("finds the image on a page, a category photo, a category band phone picture and a place", async () => {
    const item = await upload("Used everywhere");
    const phone = await upload("Phone version");
    await saveDraft({ key: "home", scope: "default", blocks: [banner(item)], ...admin });
    await Category.create({ slug: "jobs", name: "Jobs", photo: { mediaId: item.id, focusX: 50, focusY: 50, alt: "Jobs" }, band: { mediaId: phone.id, phoneMediaId: item.id, focusX: 50, focusY: 50 } });
    await Location.create({ type: "city", slug: "surat", name: "Surat", photo: { mediaId: item.id, focusX: 40, focusY: 40 } });
    const usages = await findMediaUsages(item.id);
    expect(usages.map((use) => `${use.kind}:${use.label || use.key}:${use.blockId}`).sort()).toEqual(["category:Jobs:band phone", "category:Jobs:photo", "page:home:" + usages.find((use) => use.kind === "page")?.blockId, "place:Surat:photo"].sort());
  });
});

describe("the Trash", () => {
  it("refuses a picture that a page or a category uses, and says where", async () => {
    const page = await upload("On a page");
    const catalogue = await upload("On a category");
    await saveDraft({ key: "home", scope: "default", blocks: [banner(page)], ...admin });
    await Category.create({ slug: "pets", name: "Pets", photo: { mediaId: catalogue.id, focusX: 50, focusY: 50, alt: "Pets" } });
    await expect(trashMedia(seo, page.id)).rejects.toThrow(/home page, draft/);
    await expect(trashMedia(seo, catalogue.id)).rejects.toThrow(/category Pets \(photo\)/);
    expect(await SiteMedia.countDocuments({ trashedAt: { $ne: null } })).toBe(0);
  });

  it("moves an unused picture to the Trash for 30 days, hides it from the library, and Undo or Restore brings it back", async () => {
    const item = await upload("Spare picture");
    const done = await trashMedia(seo, item.id);
    expect(new Date(done.purgeAfter).getTime() - Date.now()).toBeGreaterThan(29 * DAY_MS);
    expect((await listSiteMedia({}, ["admin"])).items).toHaveLength(0);
    expect((await listSiteMedia({ trash: true }, ["admin"])).items.map((row) => row.id)).toEqual([item.id]);
    await expect(trashMedia(seo, item.id)).rejects.toBeInstanceOf(ConflictError);
    expect(await undoEvent(seo, done.eventId)).toMatchObject({ ok: true });
    expect((await listSiteMedia({}, ["admin"])).items).toHaveLength(1);
    const again = await trashMedia(seo, item.id);
    expect(again.eventId).not.toBe(done.eventId);
    await restoreMedia(seo, item.id);
    expect((await listSiteMedia({}, ["admin"])).items).toHaveLength(1);
    await expect(restoreMedia(seo, item.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("is for staff who may use the library only, and a refusal is logged", async () => {
    const item = await upload("Not yours");
    const support = { ...seo, roles: ["support"] };
    await expect(trashMedia(support, item.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getMediaDetail(["support"], item.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(1);
  });

  it("purges only pictures past their date, removes the file, keeps one that is in use again, and logs it locked", async () => {
    const old = await upload("Old trash");
    const fresh = await upload("Fresh trash");
    const back = await upload("Used again");
    for (const item of [old, fresh, back]) await trashMedia(seo, item.id);
    await SiteMedia.updateOne({ _id: old.id }, { $set: { purgeAfter: new Date(Date.now() - 1000) } });
    await SiteMedia.updateOne({ _id: back.id }, { $set: { purgeAfter: new Date(Date.now() - 1000) } });
    await Category.create({ slug: "cars", name: "Cars", photo: { mediaId: back.id, focusX: 50, focusY: 50, alt: "Cars" } });
    expect(await purgeTrashedMedia()).toEqual({ purged: 1, kept: 1 });
    expect(await SiteMedia.findById(old.id)).toBeNull();
    expect(existsSync(path.join(dir, path.basename(old.url)))).toBe(false);
    expect((await SiteMedia.findById(fresh.id).lean())?.trashedAt).toBeTruthy();
    expect((await SiteMedia.findById(back.id).lean())?.trashedAt ?? null).toBeNull();
    expect(await AuditEvent.findOne({ action: "media.purge" }).lean()).toMatchObject({ targetId: old.id, lock: "purged" });
  });
});

describe("details", () => {
  it("saves alt text, a phone picture and the focus point, with Undo, and refuses a bad value", async () => {
    const main = await upload("Home banner");
    const phone = await upload("Home banner on a phone");
    const done = await saveMediaDetails(seo, main.id, { alt: "Home banner with people in a street", phoneMediaId: phone.id, focusX: 30, focusY: 70 });
    expect(done.changed).toBe(true);
    const detail = await getMediaDetail(["admin"], main.id);
    expect(detail.item).toMatchObject({ alt: "Home banner with people in a street", focusX: 30, focusY: 70, phoneVariantId: phone.id });
    expect(detail.phone?.id).toBe(phone.id);
    expect(await undoEvent(seo, done.eventId)).toMatchObject({ ok: true });
    expect((await getMediaDetail(["admin"], main.id)).item).toMatchObject({ alt: "Home banner", focusX: 50, phoneVariantId: null });
    await expect(saveMediaDetails(seo, main.id, { alt: "x", phoneMediaId: null, focusX: 50, focusY: 50 })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveMediaDetails(seo, main.id, { alt: "Fine text", phoneMediaId: main.id, focusX: 50, focusY: 50 })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveMediaDetails(seo, main.id, { alt: "Fine text", phoneMediaId: null, focusX: 150, focusY: 50 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("does nothing when nothing changed, and refuses a picture in the Trash", async () => {
    const item = await upload("Plain picture");
    expect((await saveMediaDetails(seo, item.id, { alt: "Plain picture", phoneMediaId: null, focusX: 50, focusY: 50 })).changed).toBe(false);
    await trashMedia(seo, item.id);
    await expect(saveMediaDetails(seo, item.id, { alt: "Another text", phoneMediaId: null, focusX: 50, focusY: 50 })).rejects.toBeInstanceOf(ConflictError);
  });

  it("undo refuses when the picture changed since", async () => {
    const item = await upload("First text here");
    const first = await saveMediaDetails(seo, item.id, { alt: "Second text here", phoneMediaId: null, focusX: 50, focusY: 50 });
    await saveMediaDetails(seo, item.id, { alt: "Third text here", phoneMediaId: null, focusX: 50, focusY: 50 });
    expect(await undoEvent(seo, first.eventId)).toMatchObject({ ok: false, reason: "conflict" });
  });
});

describe("tab numbers", () => {
  it("counts pictures, not used, missing alt, trash and notices", async () => {
    const used = await upload("Used one");
    await upload("Spare one");
    const gone = await upload("Going to trash");
    await SiteMedia.updateOne({ _id: await upload("Auto alt picture").then((row) => row.id) }, { $set: { altAuto: true } });
    await saveDraft({ key: "home", scope: "default", blocks: [banner(used)], ...admin });
    await trashMedia(seo, gone.id);
    await Banner.create({ slot: "top", title: "Notice", enabled: true });
    expect(await mediaTabCounts(["admin"])).toEqual({ pictures: 3, unused: 2, missing: 1, trash: 1, notices: 1 });
  });
});

import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publish, saveDraft } from "@/server/layout/service";
import {
  SITE_MEDIA_MAX_BYTES,
  SITE_MEDIA_OVERSIZE_BYTES,
  deleteSiteMedia,
  findUsages,
  listSiteMedia,
  readImageSize,
  updateSiteMedia,
  uploadSiteMedia,
} from "@/server/layout/media";
import { AuditEvent, SiteMedia } from "@/server/models";
import { denyTerm } from "@/server/shared/policy";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "admin@example.test", roles: ["admin"] };

/* Minimal headers: enough for the size reader, not decodable pictures. */
function png(width: number, height: number, extra = 0) {
  const head = Buffer.alloc(33);
  head.writeUInt32BE(0x89504e47, 0);
  head.writeUInt32BE(0x0d0a1a0a, 4);
  head.writeUInt32BE(13, 8);
  head.write("IHDR", 12, "ascii");
  head.writeUInt32BE(width, 16);
  head.writeUInt32BE(height, 20);
  return Buffer.concat([head, Buffer.alloc(extra)]);
}
function jpeg(width: number, height: number) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.alloc(19);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}
function webpX(width: number, height: number) {
  const buf = Buffer.alloc(40);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(32, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8X", 12, "ascii");
  buf.writeUInt32LE(10, 16);
  buf.writeUIntLE(width - 1, 24, 3);
  buf.writeUIntLE(height - 1, 27, 3);
  return buf;
}

let dir = "";

beforeAll(async () => {
  await connectMemoryMongo();
  dir = await mkdtemp(path.join(os.tmpdir(), "site-media-"));
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

describe("image headers", () => {
  it("reads the size of png, jpeg and webp", () => {
    expect(readImageSize(png(640, 480), "image/png")).toEqual({ width: 640, height: 480 });
    expect(readImageSize(jpeg(800, 600), "image/jpeg")).toEqual({ width: 800, height: 600 });
    expect(readImageSize(webpX(1024, 512), "image/webp")).toEqual({ width: 1024, height: 512 });
  });

  it("returns null when the bytes are not the declared type", () => {
    expect(readImageSize(png(10, 10), "image/jpeg")).toBeNull();
    expect(readImageSize(jpeg(10, 10), "image/png")).toBeNull();
    expect(readImageSize(Buffer.from("not an image at all, just text"), "image/webp")).toBeNull();
  });
});

describe("upload", () => {
  it("saves the file, the record and an audit entry", async () => {
    const item = await uploadSiteMedia({ file: { type: "image/png", data: png(640, 480) }, alt: "A bright living room", tags: "Hero, Living Room", ...admin });
    expect(item.width).toBe(640);
    expect(item.url).toMatch(/^\/uploads\/[0-9a-f]{24}\.png$/);
    expect(item.tags).toEqual(["hero", "living-room"]);
    expect(await readdir(dir)).toHaveLength(1);
    expect(await SiteMedia.countDocuments()).toBe(1);
    expect(await AuditEvent.countDocuments({ action: "media.site.upload" })).toBe(1);
  });

  it("requires alt text", async () => {
    for (const alt of [undefined, "", "  ", "ab"]) {
      await expect(uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt, ...admin })).rejects.toThrow(/alt/i);
    }
    await expect(uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "x".repeat(126), ...admin })).rejects.toThrow(/125/);
    expect(await SiteMedia.countDocuments()).toBe(0);
  });

  it("rejects other file types, fake files, empty files and files over 5 MB", async () => {
    await expect(uploadSiteMedia({ file: { type: "image/gif", data: png(10, 10) }, alt: "A picture", ...admin })).rejects.toThrow(/jpeg, png and webp/i);
    await expect(uploadSiteMedia({ file: { type: "image/svg+xml", data: Buffer.from("<svg onload=alert(1)>") }, alt: "A picture", ...admin })).rejects.toThrow(/jpeg, png and webp/i);
    await expect(uploadSiteMedia({ file: { type: "image/jpeg", data: png(10, 10) }, alt: "A picture", ...admin })).rejects.toThrow(/valid/i);
    await expect(uploadSiteMedia({ file: { type: "image/png", data: Buffer.alloc(0) }, alt: "A picture", ...admin })).rejects.toThrow(/empty/i);
    await expect(uploadSiteMedia({ file: { type: "image/png", data: png(10, 10, SITE_MEDIA_MAX_BYTES) }, alt: "A picture", ...admin })).rejects.toThrow(/5 MB/);
    expect(await SiteMedia.countDocuments()).toBe(0);
    expect(await readdir(dir)).toHaveLength(0);
  });

  it("applies the forbidden-terms list to alt text and tags", async () => {
    const term = denyTerm("esc", "ort");
    await expect(uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: `Our ${term} team`, ...admin })).rejects.toThrow(/not allowed/i);
    await expect(uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "A picture", tags: term, ...admin })).rejects.toThrow(/not allowed/i);
  });

  it("is for admins only", async () => {
    for (const roles of [["user"], ["moderator"], ["seo_editor"]]) {
      await expect(uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "A picture", email: "x@example.test", roles })).rejects.toThrow(/admin/i);
      await expect(listSiteMedia({}, roles)).rejects.toThrow(/admin/i);
    }
  });
});

describe("library", () => {
  async function seed() {
    const a = await uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "Sunny balcony", tags: "balcony", ...admin });
    const b = await uploadSiteMedia({ file: { type: "image/jpeg", data: jpeg(20, 20) }, alt: "Office desk", tags: "office", ...admin });
    // Rows from before alt text was required: written straight to the collection, skipping model validation.
    await SiteMedia.collection.insertOne({ url: "/uploads/site/legacy.png", objectKey: "site/legacy.png", alt: "", width: 5, height: 5, bytes: 100, contentType: "image/png", tags: [], uploadedBy: "old", createdAt: new Date() });
    await SiteMedia.collection.insertOne({ url: "/uploads/site/big.png", objectKey: "site/big.png", alt: "Huge photo", width: 5000, height: 4000, bytes: SITE_MEDIA_OVERSIZE_BYTES + 1, contentType: "image/png", tags: [], uploadedBy: "old", createdAt: new Date() });
    return { a, b };
  }

  it("searches by alt text and tag", async () => {
    await seed();
    expect((await listSiteMedia({ q: "balcony" }, admin.roles)).items.map((i) => i.alt)).toEqual(["Sunny balcony"]);
    expect((await listSiteMedia({ tag: "office" }, admin.roles)).items.map((i) => i.alt)).toEqual(["Office desk"]);
  });

  it("filters images missing alt and oversize images", async () => {
    await seed();
    const missing = await listSiteMedia({ missingAlt: true }, admin.roles);
    expect(missing.items).toHaveLength(1);
    expect(missing.items[0].missingAlt).toBe(true);
    const big = await listSiteMedia({ oversize: true }, admin.roles);
    expect(big.items.map((i) => i.alt)).toEqual(["Huge photo"]);
  });

  it("updates alt text with the same rules as upload", async () => {
    const { a } = await seed();
    const changed = await updateSiteMedia(a.id, { alt: "Balcony at sunrise", tags: "balcony, morning" }, admin.email, admin.roles);
    expect(changed.alt).toBe("Balcony at sunrise");
    expect(changed.tags).toEqual(["balcony", "morning"]);
    await expect(updateSiteMedia(a.id, { alt: "" }, admin.email, admin.roles)).rejects.toThrow(/alt/i);
    expect(await AuditEvent.countDocuments({ action: "media.site.update" })).toBe(1);
  });
});

describe("delete", () => {
  const banner = (image: unknown) => ({ type: "banner", visible: true, props: { title: "Hello", image } });

  it("deletes an unused image and removes its file", async () => {
    const item = await uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "Unused picture", ...admin });
    expect(await readdir(dir)).toHaveLength(1);
    await deleteSiteMedia(item.id, admin.email, admin.roles);
    expect(await SiteMedia.countDocuments()).toBe(0);
    expect(await readdir(dir)).toHaveLength(0);
    expect(await AuditEvent.countDocuments({ action: "media.site.delete" })).toBe(1);
  });

  it("refuses to delete an image used in a draft, and says where", async () => {
    const item = await uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "Used picture", ...admin });
    await saveDraft({ key: "home", scope: "default", blocks: [banner({ assetId: item.id, src: item.url, alt: item.alt, width: 10, height: 10 })], ...admin });
    await expect(deleteSiteMedia(item.id, admin.email, admin.roles)).rejects.toThrow(/home page, draft/);
    expect(await SiteMedia.countDocuments()).toBe(1);
    expect(existsSync(path.join(dir, path.basename(item.url)))).toBe(true);
  });

  it("refuses to delete an image used in a published layout, even after the draft dropped it", async () => {
    const item = await uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "Published picture", ...admin });
    await saveDraft({ key: "home", scope: "default", blocks: [banner({ assetId: item.id, src: item.url, alt: item.alt, width: 10, height: 10 })], ...admin });
    await publish({ key: "home", scope: "default", ...admin });
    await saveDraft({ key: "home", scope: "default", blocks: [], ...admin });
    const usages = await findUsages(item.id);
    expect(usages.map((u) => u.where)).toEqual(["published"]);
    await expect(deleteSiteMedia(item.id, admin.email, admin.roles)).rejects.toThrow(/published/);
    expect(await SiteMedia.countDocuments()).toBe(1);
  });

  it("lists unused images", async () => {
    const used = await uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "In use here", ...admin });
    await uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "Nobody uses me", ...admin });
    await saveDraft({ key: "home", scope: "default", blocks: [banner({ assetId: used.id, src: used.url, alt: used.alt, width: 10, height: 10 })], ...admin });
    const unused = await listSiteMedia({ unused: true }, admin.roles);
    expect(unused.items.map((i) => i.alt)).toEqual(["Nobody uses me"]);
  });
});

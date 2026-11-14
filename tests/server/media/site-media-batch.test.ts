import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SITE_MEDIA_MAX_BYTES, listSiteMedia, updateSiteMedia, uploadSiteMedia } from "@/server/layout/media";
import { SiteMedia } from "@/server/models";
import { denyTerm } from "@/server/shared/policy";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "admin@example.test", roles: ["admin"] };

/** A PNG header that the size reader accepts. */
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

let dir = "";

beforeAll(async () => {
  await connectMemoryMongo();
  dir = await mkdtemp(path.join(os.tmpdir(), "site-media-batch-"));
  process.env.SITE_MEDIA_DIR = dir;
});

beforeEach(async () => {
  await clearMemoryMongo();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.SITE_MEDIA_DIR;
  await disconnectMemoryMongo();
});

describe("batch upload alt text", () => {
  it("fills the alt text from the file name, marks it for review and keeps it in the missing alt filter", async () => {
    const item = await uploadSiteMedia({
      file: { type: "image/png", data: png(640, 480) },
      alt: "",
      autoAlt: true,
      fileName: "red-sofa_01.png",
      tags: "",
      ...admin,
    });
    expect(item.alt).toBe("Red sofa");
    expect(item.autoAlt).toBe(true);
    expect(item.missingAlt).toBe(true);
    const stored = await SiteMedia.findById(item.id);
    expect(stored?.altAuto).toBe(true);
    const missing = await listSiteMedia({ missingAlt: true }, admin.roles);
    expect(missing.items.map((row) => row.id)).toContain(item.id);
  });

  it("does not auto-fill when the alt text was typed, and still requires it", async () => {
    await expect(uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "", autoAlt: false, fileName: "red-sofa.png", ...admin })).rejects.toThrow(/alt/i);
    const typed = await uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "A red sofa in a bright room", autoAlt: true, fileName: "x.png", ...admin });
    expect(typed.alt).toBe("A red sofa in a bright room");
    expect(typed.autoAlt).toBe(false);
  });

  it("clears the review mark once someone checks and saves the alt text", async () => {
    const item = await uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "", autoAlt: true, fileName: "kitchen_02.png", ...admin });
    const saved = await updateSiteMedia(item.id, { alt: "Kitchen with a white island", tags: "kitchen" }, admin.email, admin.roles);
    expect(saved.alt).toBe("Kitchen with a white island");
    expect(saved.autoAlt).toBe(false);
    expect(saved.missingAlt).toBe(false);
  });

  it("refuses an auto alt that uses a forbidden term, so that file fails with the reason", async () => {
    const term = denyTerm("esc", "ort");
    await expect(
      uploadSiteMedia({ file: { type: "image/png", data: png(10, 10) }, alt: "", autoAlt: true, fileName: `${term}.png`, ...admin }),
    ).rejects.toThrow(/not allowed/i);
    expect(await SiteMedia.countDocuments()).toBe(0);
  });

  it("allows up to 8 MB per file", () => {
    expect(SITE_MEDIA_MAX_BYTES).toBe(8 * 1024 * 1024);
  });
});

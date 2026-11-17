import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bandImageFor, cityBandImageFor } from "@/components/new/band-image";
import { photoOf } from "@/components/h714/photo";
import { loadCatalogueImages, mergeCatalogueImages } from "@/server/site-links/catalogue-images";
import { readShellConfig, readStoredShellConfig, saveShellConfig } from "@/server/site-links/shell-config";
import { defaultShellConfig, type ShellImage } from "@/server/site-links/shell-config-rules";
import { Category, Location, SiteMedia } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H7.160: the pictures set in the new boxes (H8.39) reach the public pages; the old rows stay as the fallback. */

const row = (scope: ShellImage["scope"], slug: string, extra: Partial<ShellImage> = {}): ShellImage => ({ scope, slug, photo: "", band: "", bandPhone: "", ...extra });

async function picture(url: string, extra: Record<string, unknown> = {}) {
  return String((await SiteMedia.create({ url, objectKey: `k-${Math.random()}`, alt: "A picture", width: 800, height: 600, bytes: 900, contentType: "image/png", tags: [], uploadedBy: "a@example.com", ...extra }))._id);
}

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
});

describe("merging the new pictures with the old rows", () => {
  it("the new picture wins for each slot it has, the old row fills the rest, and a slug is matched in any case", () => {
    const old = [row("category", "dating", { photo: "/uploads/old-card.png", band: "/uploads/old-band.png", bandPhone: "/uploads/old-phone.png", focusX: 10, bandFocusX: 20 }), row("city", "surat", { band: "/uploads/surat-old.png" })];
    const fresh = [row("category", "Dating", { photo: "/uploads/new-card.png", focusX: 70, focusY: 30 }), row("city", "pune", { band: "/uploads/pune-new.png", bandFocusX: 40 })];
    const merged = mergeCatalogueImages(old, fresh);
    expect(merged).toHaveLength(3);
    expect(merged[0]).toMatchObject({ photo: "/uploads/new-card.png", focusX: 70, focusY: 30, band: "/uploads/old-band.png", bandPhone: "/uploads/old-phone.png", bandFocusX: 20 });
    expect(merged[1]).toMatchObject({ slug: "surat", band: "/uploads/surat-old.png" });
    expect(merged[2]).toMatchObject({ scope: "city", slug: "pune", band: "/uploads/pune-new.png", bandFocusX: 40 });
    expect(old[0].photo).toBe("/uploads/old-card.png");
    expect(mergeCatalogueImages([], [])).toEqual([]);
  });
});

describe("a new band brings its own phone band", () => {
  it("a partner who sets only the computer band does not keep the old row's phone picture; the old phone band stays when only the card photo is new", () => {
    const old = [row("category", "dating", { photo: "/uploads/old-card.png", band: "/uploads/old-band.png", bandPhone: "/uploads/old-phone.png" })];
    const onlyBand = mergeCatalogueImages(old, [row("category", "dating", { band: "/uploads/new-band.png", bandFocusX: 10, bandFocusY: 20 })]);
    expect(onlyBand[0]).toMatchObject({ band: "/uploads/new-band.png", bandPhone: "", photo: "/uploads/old-card.png", bandFocusX: 10, bandFocusY: 20 });
    const withPhone = mergeCatalogueImages(old, [row("category", "dating", { band: "/uploads/new-band.png", bandPhone: "/uploads/new-phone.png" })]);
    expect(withPhone[0].bandPhone).toBe("/uploads/new-phone.png");
    const onlyCard = mergeCatalogueImages(old, [row("category", "dating", { photo: "/uploads/new-card.png" })]);
    expect(onlyCard[0]).toMatchObject({ photo: "/uploads/new-card.png", band: "/uploads/old-band.png", bandPhone: "/uploads/old-phone.png" });
  });
});

describe("what the public pages read", () => {
  it("reads the pictures of categories and cities from the new fields, and ignores a picture in the Trash and rows of other kinds", async () => {
    const card = await picture("/uploads/dating-card.png");
    const band = await picture("/uploads/dating-band.png");
    const phone = await picture("/uploads/dating-phone.png");
    const trashed = await picture("/uploads/old.png", { trashedAt: new Date() });
    await Category.create({ slug: "dating", name: "Dating", enabled: true, photo: { mediaId: card, focusX: 30, focusY: 40, alt: "Card" }, band: { mediaId: band, phoneMediaId: phone, focusX: 60, focusY: 20, alt: "Band" } });
    await Category.create({ slug: "jobs", name: "Jobs", enabled: true, photo: { mediaId: trashed, focusX: 50, focusY: 50, alt: "Gone" } });
    await Category.create({ slug: "pets", name: "Pets", enabled: true });
    await Location.create({ type: "city", slug: "surat", name: "Surat", enabled: true, band: { mediaId: band, focusX: 10, focusY: 90, alt: "City band" } });
    await Location.create({ type: "district", slug: "adajan", name: "Adajan", enabled: true, band: { mediaId: band, focusX: 10, focusY: 90, alt: "Not offered" } });
    const rows = await loadCatalogueImages();
    expect(rows.map((item) => `${item.scope}:${item.slug}`).sort()).toEqual(["category:dating", "city:surat"]);
    expect(rows.find((item) => item.slug === "dating")).toMatchObject({ photo: "/uploads/dating-card.png", band: "/uploads/dating-band.png", bandPhone: "/uploads/dating-phone.png", focusX: 30, focusY: 40, bandFocusX: 60, bandFocusY: 20 });

    const shell = await readShellConfig();
    expect(photoOf(shell, "category", "dating")).toBe("/uploads/dating-card.png");
    expect(bandImageFor(shell, "dating")?.band).toBe("/uploads/dating-band.png");
    expect(cityBandImageFor(shell, "surat")?.band).toBe("/uploads/dating-band.png");
    expect(bandImageFor(shell, "dating", "surat")?.band).toBe("/uploads/dating-band.png");
    expect(photoOf(shell, "category", "jobs")).toBe("");
  });

  it("the old rows still work when the new boxes are empty, and the new picture wins when both are set; the editors still see only what was saved", async () => {
    await saveShellConfig({
      actorId: "000000000000000000000071",
      roles: ["admin"],
      requestId: "r",
      config: { ...defaultShellConfig(), media: { images: [{ scope: "category", slug: "dating", photo: "/uploads/old-card.png", band: "/uploads/old-band.png", bandPhone: "" }] } },
    });
    expect(photoOf(await readShellConfig(), "category", "dating")).toBe("/uploads/old-card.png");
    const card = await picture("/uploads/new-card.png");
    await Category.create({ slug: "dating", name: "Dating", enabled: true, photo: { mediaId: card, focusX: 50, focusY: 50, alt: "Card" } });
    const shell = await readShellConfig();
    expect(photoOf(shell, "category", "dating")).toBe("/uploads/new-card.png");
    expect(bandImageFor(shell, "dating")?.band).toBe("/uploads/old-band.png");
    const stored = await readStoredShellConfig();
    expect(stored.media.images).toHaveLength(1);
    expect(stored.media.images[0].photo).toBe("/uploads/old-card.png");
  });
});

import { describe, expect, it } from "vitest";
import { bandChoice, bandImageFor, cityBandImageFor, sameSlug } from "@/components/new/band-image";
import { photoOf } from "@/components/h714/photo";
import { defaultShellConfig } from "@/server/site-links/shell-config-rules";

const base = defaultShellConfig();
const shellWith = (slug: string, scope: "city" | "category" = "city") => ({
  ...base,
  media: { images: [{ scope, slug, photo: "/uploads/p.jpg", band: "/uploads/b.jpg", bandPhone: "" }] },
});

describe("H7.115 slugs match without regard to case", () => {
  it("compares both sides in lower case and ignores outer spaces", () => {
    expect(sameSlug("Surat", "surat")).toBe(true);
    expect(sameSlug(" surat ", "SURAT")).toBe(true);
    expect(sameSlug("surat", "vadodara")).toBe(false);
    expect(sameSlug("", "")).toBe(false);
    expect(sameSlug(undefined, "surat")).toBe(false);
  });

  it("finds the city band image when the admin typed the slug with capitals", () => {
    expect(cityBandImageFor(shellWith("Surat"), "surat")?.band).toBe("/uploads/b.jpg");
    expect(cityBandImageFor(shellWith("surat"), "SURAT")?.band).toBe("/uploads/b.jpg");
    expect(cityBandImageFor(shellWith("Surat"), "mumbai")).toBeNull();
  });

  it("applies to the category band, the band choice and the card photo", () => {
    expect(bandImageFor(shellWith("Dating", "category"), "dating")?.band).toBe("/uploads/b.jpg");
    expect(bandChoice(shellWith("SURAT"), null, { city: "surat" })?.band).toBe("/uploads/b.jpg");
    expect(photoOf(shellWith("Surat"), "city", "surat")).toBe("/uploads/p.jpg");
    expect(photoOf(shellWith("Surat"), "city", "mumbai")).toBe("");
  });
});

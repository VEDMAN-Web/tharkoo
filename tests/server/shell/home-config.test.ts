import { describe, expect, it } from "vitest";
import { bandImageFor } from "@/components/new/band-image";
import { defaultShellConfig, isSafeImageUrl, normaliseShellConfig, shellConfigSchema } from "@/server/site-links/shell-config-rules";

/**
 * H7.4: the New design home text (trust pills, How it works) and the listing title band images.
 */

describe("H7.4 home config defaults", () => {
  it("ships five trust pills and three How it works steps", () => {
    const config = defaultShellConfig();
    expect(config.home.trust).toHaveLength(5);
    expect(config.home.steps).toHaveLength(3);
    expect(config.media.images).toEqual([]);
  });

  it("fills the home fields from the defaults when nothing is stored", () => {
    const config = normaliseShellConfig({});
    expect(config.home.trust.map((pill) => pill.label)).toContain("Free to post");
    expect(config.home.steps[2].title).toBe("Verify on video");
  });

  it("keeps the stored trust pills and caps them at five, with an unknown tone falling back to pink", () => {
    const stored = Array.from({ length: 7 }, (_, i) => ({ label: `Pill ${i + 1}`, tone: i === 0 ? "nope" : "green" }));
    const config = normaliseShellConfig({ home: { trust: stored } });
    expect(config.home.trust).toHaveLength(5);
    expect(config.home.trust[0]).toEqual({ label: "Pill 1", tone: "pink" });
  });

  it("strips markup from stored step text and caps the steps at three", () => {
    const config = normaliseShellConfig({
      home: {
        steps: [
          { title: "<b>One</b>", text: "<script>x</script>Post it" },
          { title: "Two", text: "Chat" },
          { title: "Three", text: "Meet" },
          { title: "Four", text: "Extra" },
        ],
      },
    });
    expect(config.home.steps).toHaveLength(3);
    expect(config.home.steps[0]).toEqual({ title: "One", text: "xPost it" });
  });

  it("accepts the home and media fields in the admin save schema", () => {
    const config = { ...defaultShellConfig(), media: { images: [] } };
    expect(shellConfigSchema.safeParse(config).success).toBe(true);
    const withoutNewFields = { ...config };
    delete (withoutNewFields as Partial<typeof config>).home;
    delete (withoutNewFields as Partial<typeof config>).media;
    expect(shellConfigSchema.safeParse(withoutNewFields).success).toBe(true);
  });
});

describe("H7.4 image URLs", () => {
  it("accepts site paths and https addresses", () => {
    expect(isSafeImageUrl("/uploads/dating.jpg")).toBe(true);
    expect(isSafeImageUrl("https://res.cloudinary.com/demo/image/upload/a.jpg")).toBe(true);
    expect(isSafeImageUrl("")).toBe(true);
  });

  it("refuses protocol-relative, plain http, quotes and spaces that could break a CSS url()", () => {
    expect(isSafeImageUrl("//evil.example/a.jpg")).toBe(false);
    expect(isSafeImageUrl("http://example.com/a.jpg")).toBe(false);
    expect(isSafeImageUrl('/a.jpg") no-repeat, url("/b')).toBe(false);
    expect(isSafeImageUrl("/a b.jpg")).toBe(false);
    expect(isSafeImageUrl("javascript:alert(1)")).toBe(false);
  });

  it("drops unsafe stored images while keeping the safe ones", () => {
    const config = normaliseShellConfig({
      media: {
        images: [
          { scope: "category", slug: "dating", photo: "/uploads/d.jpg", band: "http://bad.example/x.jpg", bandPhone: "" },
          { scope: "city", slug: "surat", photo: "", band: "/uploads/surat.jpg", bandPhone: "/uploads/surat-m.jpg" },
          { scope: "category", slug: "wellness", photo: "", band: "", bandPhone: "" },
        ],
      },
    });
    expect(config.media.images).toEqual([
      { scope: "category", slug: "dating", photo: "/uploads/d.jpg", band: "", bandPhone: "" },
      { scope: "city", slug: "surat", photo: "", band: "/uploads/surat.jpg", bandPhone: "/uploads/surat-m.jpg" },
    ]);
  });
});

describe("H7.4 listing title band image", () => {
  const base = defaultShellConfig();
  const images = [
    { scope: "category" as const, slug: "dating", photo: "", band: "/uploads/cat.jpg", bandPhone: "" },
    { scope: "city" as const, slug: "surat", photo: "", band: "/uploads/city.jpg", bandPhone: "" },
  ];

  it("uses the city image over the category image", () => {
    const shell = { ...base, media: { images } };
    expect(bandImageFor(shell, "dating", "surat")?.band).toBe("/uploads/city.jpg");
  });

  it("falls back to the category image when the city has none", () => {
    const shell = { ...base, media: { images } };
    expect(bandImageFor(shell, "dating", "mumbai")?.band).toBe("/uploads/cat.jpg");
  });

  it("returns null when neither has an image, so the gradient shows", () => {
    expect(bandImageFor({ ...base, media: { images: [] } }, "dating", "surat")).toBeNull();
  });
});

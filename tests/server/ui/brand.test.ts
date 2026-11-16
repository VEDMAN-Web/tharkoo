import { describe, expect, it } from "vitest";
import { brandLogoUrl, LOGO_DARK_DEFAULT, LOGO_LIGHT_DEFAULT, siteLogos } from "@/lib/brand";
import { readContent } from "@/lib/ui/site-content";

describe("logo addresses (H7.105)", () => {
  it("uses the shipped logos when nothing is saved", () => {
    expect(siteLogos({})).toEqual({ light: LOGO_LIGHT_DEFAULT, dark: LOGO_DARK_DEFAULT });
    expect(LOGO_LIGHT_DEFAULT).toBe("/brand/logo-horizontal.png");
  });

  it("accepts a site path or an https image and refuses anything else", () => {
    expect(brandLogoUrl("/uploads/logo.png", "x")).toBe("/uploads/logo.png");
    expect(brandLogoUrl("https://res.cloudinary.com/a/b.png", "x")).toBe("https://res.cloudinary.com/a/b.png");
    expect(brandLogoUrl("http://a.test/b.png", "x")).toBe("x");
    expect(brandLogoUrl("//evil.test/b.png", "x")).toBe("x");
    expect(brandLogoUrl("javascript:alert(1)", "x")).toBe("x");
    expect(brandLogoUrl('https://a.test/b.png" onerror="x', "x")).toBe("x");
    expect(brandLogoUrl("", "x")).toBe("x");
  });
});

describe("home banner with the headline in the picture (H7.105)", () => {
  it("is off by default and keeps the long alt text", () => {
    const base = readContent(null);
    expect(base.hero.textInImage).toBe(false);
    const alt = "Woman in a plum satin dress on a velvet sofa; Single? Taken? Doesn't matter, Tharkoo is for everyone";
    const hero = readContent({ content: { hero: { photo: "/placeholders/hero.webp", photoAlt: alt, textInImage: true, photoWidth: 2400, photoHeight: 1029 } } }).hero;
    expect(hero).toMatchObject({ textInImage: true, photoWidth: 2400, photoHeight: 1029, photoAlt: alt });
  });

  it("ignores a size that is not a number", () => {
    expect(readContent({ content: { hero: { photoWidth: "wide", photoHeight: 5 } } }).hero).toMatchObject({ photoWidth: 0, photoHeight: 0 });
  });
});

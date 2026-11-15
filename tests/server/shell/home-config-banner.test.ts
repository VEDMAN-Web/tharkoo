import { describe, expect, it } from "vitest";
import { defaultSiteContent, sanitizeSiteContent } from "@/lib/ui/site-content";

describe("home banner settings", () => {
  it("defaults to no phone picture and the automatic text plate", () => {
    const hero = defaultSiteContent().hero;
    expect(hero.photoPhone).toBe("");
    expect(hero.plate).toBe("auto");
  });

  it("keeps a safe phone picture and the chosen plate", () => {
    const result = sanitizeSiteContent({ hero: { photo: "/a.webp", photoPhone: "/b.webp", plate: "on" } }, { lenient: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.hero.photo).toBe("/a.webp");
    expect(result.content.hero.photoPhone).toBe("/b.webp");
    expect(result.content.hero.plate).toBe("on");
  });

  it("drops an unsafe phone picture and treats an unknown plate as automatic", () => {
    const result = sanitizeSiteContent({ hero: { photoPhone: "javascript:alert(1)", plate: "maybe" } }, { lenient: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.hero.photoPhone).toBe("");
    expect(result.content.hero.plate).toBe("auto");
  });

  it("keeps existing saved content working without the new fields", () => {
    const result = sanitizeSiteContent({ hero: { desktop: "Old headline", photo: "/old.webp" } }, { lenient: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.hero.desktop).toBe("Old headline");
    expect(result.content.hero.photoPhone).toBe("");
    expect(result.content.hero.plate).toBe("auto");
  });
});

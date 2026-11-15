import { describe, expect, it } from "vitest";
import { defaultSiteContent, sanitizeSiteContent } from "@/lib/ui/site-content";

describe("home banner settings", () => {
  it("defaults to no phone picture, the text plate on for every screen, and the focus at centre, 20% down", () => {
    // H7.4c (#80): the frosted plate is on by default on computers and phones; the admin can switch it off.
    const hero = defaultSiteContent().hero;
    expect(hero.photoPhone).toBe("");
    expect(hero.plate).toBe("on");
    expect(hero.focusX).toBe(50);
    expect(hero.focusY).toBe(20);
    expect(hero.phoneFocusX).toBe(50);
    expect(hero.phoneFocusY).toBe(20);
  });

  it("keeps a safe phone picture and the chosen plate", () => {
    const result = sanitizeSiteContent({ hero: { photo: "/a.webp", photoPhone: "/b.webp", plate: "on" } }, { lenient: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.hero.photo).toBe("/a.webp");
    expect(result.content.hero.photoPhone).toBe("/b.webp");
    expect(result.content.hero.plate).toBe("on");
  });

  it("drops an unsafe phone picture and treats an unknown plate as on", () => {
    // H7.4c: only "off" turns the plate off. Anything else, including the old "auto", shows it.
    const result = sanitizeSiteContent({ hero: { photoPhone: "javascript:alert(1)", plate: "maybe" } }, { lenient: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.hero.photoPhone).toBe("");
    expect(result.content.hero.plate).toBe("on");
  });

  it("keeps the plate off only when the admin chose off, and keeps a focus point inside 0 to 100", () => {
    const off = sanitizeSiteContent({ hero: { plate: "off", focusX: 130, focusY: -5 } }, { lenient: true });
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    expect(off.content.hero.plate).toBe("off");
    expect(off.content.hero.focusX).toBe(100);
    expect(off.content.hero.focusY).toBe(0);
  });

  it("keeps existing saved content working without the new fields", () => {
    const result = sanitizeSiteContent({ hero: { desktop: "Old headline", photo: "/old.webp" } }, { lenient: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.hero.desktop).toBe("Old headline");
    expect(result.content.hero.photoPhone).toBe("");
    expect(result.content.hero.plate).toBe("on");
    expect(result.content.hero.focusY).toBe(20);
  });
});

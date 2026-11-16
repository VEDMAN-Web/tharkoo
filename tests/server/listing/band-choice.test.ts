import { describe, expect, it } from "vitest";
import { defaultShellConfig, type ShellConfig, type ShellImage } from "@/server/site-links/shell-config-rules";
import { bandChoice, bandStyleFor, heroBandFrom } from "@/components/new/band-image";

const HERO = { band: "https://cdn.example/hero.jpg", bandPhone: "https://cdn.example/hero-phone.jpg" };

function shellWith(images: Partial<ShellImage>[]): ShellConfig {
  const shell = defaultShellConfig();
  shell.media.images = images.map((image) => ({ scope: "category", slug: "", photo: "", band: "", bandPhone: "", ...image }) as ShellImage);
  return shell;
}

describe("bandChoice (H7.32 band rule)", () => {
  const shell = shellWith([
    { scope: "category", slug: "dating", band: "https://cdn.example/dating.jpg", bandPhone: "https://cdn.example/dating-phone.jpg" },
    { scope: "state", slug: "gujarat", band: "https://cdn.example/gujarat.jpg" },
    { scope: "city", slug: "surat", band: "https://cdn.example/surat.jpg", bandPhone: "" },
  ]);

  it("a city page takes its city band, then its state band, then the hero", () => {
    expect(bandChoice(shell, HERO, { city: "surat", state: "gujarat" })?.band).toBe("https://cdn.example/surat.jpg");
    expect(bandChoice(shell, HERO, { city: "jaipur", state: "gujarat" })?.band).toBe("https://cdn.example/gujarat.jpg");
    expect(bandChoice(shell, HERO, { city: "jaipur", state: "rajasthan" })).toEqual(HERO);
  });

  it("a category page takes its category band, then the hero, never the gradient", () => {
    expect(bandChoice(shell, HERO, { category: "dating" })?.band).toBe("https://cdn.example/dating.jpg");
    expect(bandChoice(shell, HERO, { category: "jobs" })).toEqual(HERO);
  });

  it("a city inside a category page wins only when the admin set a band for that city", () => {
    expect(bandChoice(shell, HERO, { city: "surat", category: "dating" })?.band).toBe("https://cdn.example/surat.jpg");
    expect(bandChoice(shell, HERO, { city: "jaipur", category: "dating" })?.band).toBe("https://cdn.example/dating.jpg");
  });

  it("the phone photo falls back to the computer photo when none is set", () => {
    const choice = bandChoice(shell, HERO, { city: "surat" });
    expect(choice?.bandPhone).toBe("https://cdn.example/surat.jpg");
    expect(bandStyleFor(choice)["--band-phone"]).toBe('url("https://cdn.example/surat.jpg")');
  });

  it("returns null when there is no hero and no admin photo, so the band keeps its gradient", () => {
    expect(bandChoice(shellWith([]), null, { category: "dating" })).toBeNull();
    expect(bandStyleFor(null)).toEqual({});
  });
});

describe("heroBandFrom", () => {
  it("reads the home hero photo, and uses it for the phone when no phone photo is set", () => {
    expect(heroBandFrom({ hero: { photo: "/hero.jpg", photoPhone: "/hero-phone.jpg" } })).toEqual({ band: "/hero.jpg", bandPhone: "/hero-phone.jpg" });
    expect(heroBandFrom({ hero: { photo: "/hero.jpg" } })).toEqual({ band: "/hero.jpg", bandPhone: "/hero.jpg" });
    expect(heroBandFrom({ hero: { photo: "" } })).toBeNull();
    expect(heroBandFrom(null)).toBeNull();
  });
});

describe("bandStyleFor focus (H7.67)", () => {
  it("sets the phone focus to the computer focus when there is no separate phone photo", () => {
    expect(bandStyleFor({ band: "https://cdn.example/a.jpg", bandPhone: "https://cdn.example/a.jpg" })["--band-focus-phone"]).toBe("72% 18%");
    expect(bandStyleFor({ band: "https://cdn.example/a.jpg", bandPhone: "https://cdn.example/a-phone.jpg" })["--band-focus-phone"]).toBeUndefined();
    expect(bandStyleFor(null)).toEqual({});
  });
});

describe("band and card focus points (H7.70)", () => {
  const withFocus = shellWith([
    { scope: "city", slug: "surat", band: "https://cdn.example/s.jpg", bandPhone: "https://cdn.example/s-phone.jpg", bandFocusX: 60, bandFocusY: 15, bandPhoneFocusX: 40 },
    { scope: "category", slug: "dating", band: "https://cdn.example/d.jpg", bandPhone: "" },
  ]);

  it("carries the admin focus points into the band style", () => {
    const style = bandStyleFor(bandChoice(withFocus, HERO, { city: "surat" }));
    expect(style["--band-focus"]).toBe("60% 15%");
    expect(style["--band-focus-phone"]).toBe("40% 12%");
  });

  it("uses the computer focus for the phone when there is no phone photo, and no variable when nothing is set", () => {
    const style = bandStyleFor(bandChoice(withFocus, HERO, { category: "dating" }));
    expect(style["--band-focus"]).toBeUndefined();
    expect(style["--band-focus-phone"]).toBe("72% 18%");
  });

  it("takes the home hero focus points for the default band", () => {
    const hero = heroBandFrom({ hero: { photo: "https://cdn.example/h.jpg", photoPhone: "https://cdn.example/h-phone.jpg", focusX: 72, focusY: 12, phoneFocusX: 50, phoneFocusY: 8 } });
    const style = bandStyleFor(bandChoice(withFocus, hero, { city: "jaipur" }));
    expect(style["--band-focus"]).toBe("72% 12%");
    expect(style["--band-focus-phone"]).toBe("50% 8%");
  });
});

describe("band source choice and focus defaults (H7.70)", () => {
  const both = shellWith([{ scope: "category", slug: "jobs", band: "https://cdn.example/wide.jpg", bandPhone: "https://cdn.example/old.jpg" }]);
  const desktopOnly = shellWith([{ scope: "category", slug: "jobs", band: "https://cdn.example/wide.jpg", bandPhone: "" }]);
  const phoneOnly = shellWith([{ scope: "category", slug: "jobs", band: "", bandPhone: "https://cdn.example/old.jpg" }]);

  it("reads the desktop and the phone photo independently", () => {
    const style = bandStyleFor(bandChoice(both, HERO, { category: "jobs" }));
    expect(style["--band-desk"]).toBe('url("https://cdn.example/wide.jpg")');
    expect(style["--band-phone"]).toBe('url("https://cdn.example/old.jpg")');
  });

  it("uses the desktop photo on the phone when no phone photo is set", () => {
    const style = bandStyleFor(bandChoice(desktopOnly, HERO, { category: "jobs" }));
    expect(style["--band-desk"]).toBe('url("https://cdn.example/wide.jpg")');
    expect(style["--band-phone"]).toBe('url("https://cdn.example/wide.jpg")');
  });

  it("uses the phone photo on the desktop when only a phone photo is set", () => {
    const style = bandStyleFor(bandChoice(phoneOnly, HERO, { category: "jobs" }));
    expect(style["--band-desk"]).toBe('url("https://cdn.example/old.jpg")');
    expect(style["--band-phone"]).toBe('url("https://cdn.example/old.jpg")');
  });

  it("carries the saved focus points of each photo and leaves the rest to the style sheet defaults", () => {
    const set = shellWith([{ scope: "category", slug: "jobs", band: "https://cdn.example/w.jpg", bandPhone: "https://cdn.example/p.jpg", bandFocusX: 70, bandFocusY: 18, bandPhoneFocusX: 50, bandPhoneFocusY: 12 }]);
    const style = bandStyleFor(bandChoice(set, HERO, { category: "jobs" }));
    expect(style["--band-focus"]).toBe("70% 18%");
    expect(style["--band-focus-phone"]).toBe("50% 12%");
    const unset = bandStyleFor(bandChoice(both, HERO, { category: "jobs" }));
    expect(unset["--band-focus"]).toBeUndefined();
    expect(unset["--band-focus-phone"]).toBeUndefined();
  });
});

describe("band style sheet defaults (H7.70)", () => {
  it("falls back to 72% 18% on a computer and 50% 12% on a phone", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/components/new/listing-spec.css", "utf8");
    expect(css).toContain("var(--band-focus, 72% 18%)");
    expect(css).toContain("var(--band-focus-phone, 50% 12%)");
  });
});

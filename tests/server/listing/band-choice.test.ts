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

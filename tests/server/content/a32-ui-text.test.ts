import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isTextKey, makeT, TEXT_DEFAULTS } from "@/lib/ui/text";

const KEYS = [
  "listing.empty.leadPlace",
  "listing.empty.buttonPlace",
  "listing.empty.leadSearch",
  "listing.empty.buttonPost",
  "listing.empty.leadTag",
  "listing.empty.buttonCategory",
  "listing.empty.leadIndia",
  "listing.empty.buttonIndia",
  "listing.fallback.nearby",
  "listing.fallback.category",
  "listing.fallback.latest",
] as const;

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

describe("empty-state and fallback words are UI text (A32)", () => {
  it("every key exists with its built-in words, and an override replaces them", () => {
    for (const key of KEYS) expect(isTextKey(key)).toBe(true);
    const t = makeT({ "listing.fallback.latest": "Fresh on Tharkoo", "listing.empty.leadPlace": "Nothing in {place}." });
    expect(t("listing.fallback.latest")).toBe("Fresh on Tharkoo");
    expect(t("listing.empty.leadPlace", { place: "Pune" })).toBe("Nothing in Pune.");
    expect(makeT()("listing.empty.leadPlace", { place: "Pune" })).toBe("No ads in Pune yet. Here are ads close by.");
    expect(makeT()("listing.fallback.nearby", { place: "Pune" })).toBe("More ads near Pune");
    expect(makeT()("listing.fallback.category", { category: "Dating" })).toBe("Dating ads across India");
    expect(TEXT_DEFAULTS["listing.empty.buttonIndia"]).toBe("Post the first ad in India");
  });

  it("the listing pages no longer carry those sentences in their code", () => {
    const banned = ["Here are ads close by", "Post the first ad in", "ads across India`", "Latest ads on Tharkoo\""];
    const pages = files(join(process.cwd(), "src", "app")).filter((path) => /(search|cities|\[category\])/.test(path));
    for (const path of pages) {
      const text = readFileSync(path, "utf8");
      for (const phrase of banned) expect(text.includes(phrase), `${path} still has "${phrase}"`).toBe(false);
    }
  });
});

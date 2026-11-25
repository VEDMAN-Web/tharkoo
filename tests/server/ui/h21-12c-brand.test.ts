import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categoryIconsFor } from "@/components/post/categoryIcons";
import { firstName } from "@/components/post/firstName";
import { Rainbow, Flower2, Heart, Sparkles } from "lucide-react";

const SEED = ["dating", "friendship", "meetups", "personal-ads", "jobs", "wellness", "property", "vehicles", "buy-and-sell", "pets", "education"].map((slug) => ({ slug }));
const unique = (list: unknown[]) => new Set(list).size === list.length;

describe("H21.12c category icons", () => {
  it("gives every shipped category its own icon", () => {
    expect(unique(categoryIconsFor(SEED))).toBe(true);
  });

  it("never shares an icon between Spa & Salon and LGBTQ+ Community", () => {
    const [spa, lgbt] = categoryIconsFor([{ slug: "spa-salon" }, { slug: "lgbtq-community" }]);
    expect(spa).toBe(Flower2);
    expect(lgbt).toBe(Rainbow);
    const [a, b] = categoryIconsFor([{ slug: "something-new", icon: "tag" }, { slug: "another-new", icon: "" }]);
    expect(a).not.toBe(b);
  });

  it("uses the admin's own icon, even over the slug's usual one", () => {
    const [first, second] = categoryIconsFor([{ slug: "dating", icon: "sparkles" }, { slug: "wellness" }]);
    expect(first).toBe(Sparkles);
    expect(second).not.toBe(Sparkles);
  });

  it("still gives different icons when two admins picked the same one", () => {
    const icons = categoryIconsFor([{ slug: "one", icon: "heart" }, { slug: "two", icon: "heart" }, { slug: "dating" }]);
    expect(icons[0]).toBe(Heart);
    expect(unique(icons)).toBe(true);
  });

  it("stays unique for a long list of unknown categories", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ slug: `new-${index}` }));
    expect(unique(categoryIconsFor([...SEED, ...many.slice(0, 18)]))).toBe(true);
  });
});

describe("H21.12c the name for the ads", () => {
  it("is the first word of the account name, up to 20 letters", () => {
    expect(firstName("Asha Rao")).toBe("Asha");
    expect(firstName("  Ravi   Kumar ")).toBe("Ravi");
    expect(firstName("A".repeat(30))).toHaveLength(20);
  });

  it("is empty for no name or an email address", () => {
    expect(firstName("")).toBe("");
    expect(firstName(undefined)).toBe("");
    expect(firstName("asha@example.com")).toBe("");
  });
});

describe("H21.12c labels and rings", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  it("puts the required mark after the label everywhere on the post steps", () => {
    for (const file of ["src/components/post/FormFields.tsx", "src/components/post/PickGroup.tsx", "src/components/post/PlaceFields.tsx"]) {
      expect(read(file)).not.toContain('"* "');
      expect(read(file)).not.toContain(">* {");
    }
  });

  it("rings the error box in the error colour", () => {
    expect(read("src/components/post/details-step.css")).toContain(".tkd-sum:focus { outline: 3px solid #b91c1c;");
  });

  it("hides the floating bubble below 1024 px and keeps an in-page help link there", () => {
    const css = read("src/components/post/post-shell.css");
    expect(css).toMatch(/@media \(max-width: 1023px\) \{\s*body:has\(\.tkp-shell\) \.tkn-float \.tkn-chat-bubble \{ display: none; \}/);
    expect(read("src/components/post/PostShell.tsx")).toContain("step-help-link");
  });
});

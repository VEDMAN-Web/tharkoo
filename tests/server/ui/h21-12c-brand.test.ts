import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categoryIconsFor } from "@/components/post/categoryIcons";
import { firstName } from "@/components/post/firstName";
import { CalendarDays, Heart, Sparkles, Tag, Users } from "lucide-react";
import { popularInterestsOf } from "@/components/post/interests";

const SEED = ["dating", "friendship", "meetups", "personal-ads", "jobs", "wellness", "property", "vehicles", "buy-and-sell", "pets", "education"].map((slug) => ({ slug }));
const unique = (list: unknown[]) => new Set(list).size === list.length;

describe("H21.12c category icons", () => {
  it("gives every shipped category its own icon", () => {
    expect(unique(categoryIconsFor(SEED))).toBe(true);
  });

  it("draws the live site's categories as the design board: tag, calendar, two people", () => {
    expect(categoryIconsFor([{ slug: "spa", icon: "" }, { slug: "meetups", icon: "" }, { slug: "transgender", icon: "" }])).toEqual([Tag, CalendarDays, Users]);
    const [spa, lgbt] = categoryIconsFor([{ slug: "spa-salon" }, { slug: "lgbtq-community" }]);
    expect(spa).toBe(Tag);
    expect(lgbt).toBe(Users);
    const all = categoryIconsFor([...SEED, { slug: "spa" }, { slug: "transgender" }, { slug: "brand-new" }]);
    expect(unique(all)).toBe(true);
    expect(all.filter((icon) => icon === Tag)).toHaveLength(1);
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

describe("H21.12c popular interests", () => {
  it("come from the category's interests options first", () => {
    expect(popularInterestsOf([{ key: "interests", type: "multiselect", options: ["Manicure", "Pedicure", "manicure", " Bridal "] }, { key: "extras", type: "multiselect", options: ["Other"] }])).toEqual(["Manicure", "Pedicure", "Bridal"]);
    expect(popularInterestsOf([{ key: "interest", type: "text", options: ["Pride"] }])).toEqual(["Pride"]);
  });

  it("else from the pick-many fields, never from a pick-one list or text", () => {
    expect(popularInterestsOf([{ key: "services", type: "multiselect", options: ["A", "B"] }, { key: "kind", type: "select", options: ["C"] }])).toEqual(["A", "B"]);
  });

  it("are empty when the category has none (the live categories today), and at most six", () => {
    expect(popularInterestsOf([{ key: "topic", type: "text", options: [] }, { key: "when", type: "date" }])).toEqual([]);
    expect(popularInterestsOf([])).toEqual([]);
    expect(popularInterestsOf([{ key: "tags", options: ["1", "2", "3", "4", "5", "6", "7", "x".repeat(40)] }])).toHaveLength(6);
  });
});

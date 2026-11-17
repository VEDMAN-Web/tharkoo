import { describe, expect, it } from "vitest";
import { buildPostCopy, POST_COPY_DEFAULTS } from "@/components/post/copy";
import { categoryIcon } from "@/components/post/categoryIcons";
import { DEFAULT_HINTS, hintsFor } from "@/components/post/placeholders";
import { RAIL_LABEL_KEYS } from "@/components/post/NewPostParts";
import { makeT } from "@/lib/ui/text";
import { validatePost } from "@/lib/ui/post-form";
import type { BlockBase } from "@/server/models/layout";

const base = { categoryId: "c", cityId: "x", nickname: "A", title: "Coffee walk", text: "A friendly morning walk and a long coffee.", phone: "9876543210", contactMode: "both", age: "", terms: true, adult: true, attrs: {}, fields: [] };

function stepBlock(stepKey: string, title: string): BlockBase {
  return { id: stepKey, type: "postStep", visible: true, props: { stepKey, title } } as unknown as BlockBase;
}

describe("post-ad copy and hints (H7.83)", () => {
  it("names the first step by what the poster does, and the rail by plain labels", () => {
    expect(POST_COPY_DEFAULTS.steps.basics.title).toBe("What are you posting?");
    expect(Object.values(RAIL_LABEL_KEYS).map((key) => makeT()(key))).toEqual(["Category", "Details", "Photos", "Contact", "Review"]);
  });

  it("upgrades the old default titles saved in a published layout, and keeps a title an admin wrote", () => {
    const copy = buildPostCopy([stepBlock("basics", "Information"), stepBlock("details", "Your data"), stepBlock("photos", "Show it off")]);
    expect(copy.steps.basics.title).toBe("What are you posting?");
    expect(copy.steps.details.title).toBe("Describe your ad");
    expect(copy.steps.photos.title).toBe("Show it off");
  });

  it("has dating wording for the title and the text, and a neutral fallback for an unknown category", () => {
    expect(hintsFor("dating")).toEqual({ title: "Looking for coffee and a walk this weekend", text: "Tell people about yourself and what you are looking for" });
    expect(hintsFor("no-such-category")).toEqual(DEFAULT_HINTS);
    expect(hintsFor(undefined)).toEqual(DEFAULT_HINTS);
    expect(hintsFor("dating").title).not.toMatch(/BHK/);
  });

  it("gives every seeded category its own icon, not a letter", () => {
    const slugs = ["dating", "friendship", "meetups", "personal-ads", "jobs", "wellness", "property", "vehicles", "buy-and-sell", "pets", "education"];
    const icons = new Set(slugs.map((slug) => categoryIcon(slug)));
    expect(icons.size).toBe(slugs.length);
    expect(categoryIcon("something-new")).toBeTruthy();
  });

  it("accepts ages 18 to 99 only", () => {
    expect(validatePost({ ...base, age: "18" }).age).toBeUndefined();
    expect(validatePost({ ...base, age: "99" }).age).toBeUndefined();
    expect(validatePost({ ...base, age: "17" }).age).toBe("Invalid field");
    expect(validatePost({ ...base, age: "100" }).age).toBe("Invalid field");
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ALT_MAX,
  changedFields,
  diffFields,
  diffValue,
  fieldErrors,
  mediaProblems,
  pageRange,
  rangeLabel,
  selectionState,
  toggleAllOnPage,
  toggleOne,
} from "@/components/admin/ui/kit-helpers";

describe("pagination maths", () => {
  it("counts pages and the rows shown on each", () => {
    expect(pageRange(8231, 1, 25)).toEqual({ page: 1, pages: 330, from: 1, to: 25 });
    expect(pageRange(8231, 330, 25)).toEqual({ page: 330, pages: 330, from: 8226, to: 8231 });
    expect(pageRange(60, 2, 50)).toEqual({ page: 2, pages: 2, from: 51, to: 60 });
  });

  it("keeps the page inside the range and copes with an empty list", () => {
    expect(pageRange(8231, 9999, 25).page).toBe(330);
    expect(pageRange(8231, 0, 25).page).toBe(1);
    expect(pageRange(0, 1, 25)).toEqual({ page: 1, pages: 1, from: 0, to: 0 });
    expect(pageRange(10, 1, 0).pages).toBe(10);
  });

  it("writes the range as 1 to 25 of 8,231", () => {
    expect(rangeLabel(8231, 1, 25)).toBe("1 to 25 of 8,231");
    expect(rangeLabel(14, 1, 25)).toBe("1 to 14 of 14");
    expect(rangeLabel(0, 1, 25)).toBe("0 to 0 of 0");
  });
});

describe("row selection", () => {
  const page = ["a", "b", "c"];

  it("tells none, some and all apart", () => {
    expect(selectionState([], page)).toBe("none");
    expect(selectionState(["b"], page)).toBe("some");
    expect(selectionState(["a", "b", "c", "z"], page)).toBe("all");
    expect(selectionState(["a"], [])).toBe("none");
  });

  it("select all picks the whole page and keeps rows from other pages", () => {
    expect(toggleAllOnPage(["z"], page)).toEqual(["z", "a", "b", "c"]);
    expect(toggleAllOnPage(["b"], page)).toEqual(["b", "a", "c"]);
  });

  it("select all on a full page clears only that page", () => {
    expect(toggleAllOnPage(["z", "a", "b", "c"], page)).toEqual(["z"]);
  });

  it("toggles one row", () => {
    expect(toggleOne(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleOne(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("field diff", () => {
  it("lists changed, added and removed fields, sorted by path", () => {
    const rows = diffFields({ title: "Flat", price: 20000, tags: ["a"] }, { title: "Flat", price: 18000, area: 950 });
    expect(rows).toEqual([
      { path: "area", kind: "added", before: "", after: "950" },
      { path: "price", kind: "changed", before: "20000", after: "18000" },
      { path: "tags", kind: "removed", before: '["a"]', after: "" },
    ]);
  });

  it("walks nested objects with a dotted path", () => {
    const rows = diffFields({ area: { sqft: 9500, name: "Adajan" }, seo: { title: "A" } }, { area: { sqft: 950, name: "Adajan" }, seo: { title: "A", description: "B" } });
    expect(rows).toEqual([
      { path: "area.sqft", kind: "changed", before: "9500", after: "950" },
      { path: "seo.description", kind: "added", before: "", after: "B" },
    ]);
  });

  it("compares arrays as a whole and ignores equal values", () => {
    expect(diffFields({ photos: [1, 2] }, { photos: [1, 2] })).toEqual([]);
    expect(diffFields({ photos: [1, 2] }, { photos: [1, 2, 3] })).toEqual([{ path: "photos", kind: "changed", before: "[1,2]", after: "[1,2,3]" }]);
    expect(diffFields(null, undefined)).toEqual([]);
  });

  it("shows values as text, empty for nothing", () => {
    expect(diffValue("Flat")).toBe("Flat");
    expect(diffValue(18000)).toBe("18000");
    expect(diffValue(null)).toBe("");
    expect(diffValue(true)).toBe("true");
  });
});

describe("media problems", () => {
  const image = (alt: string) => ({ image: { src: "/x.jpg", alt } });

  it("needs a picture when required", () => {
    expect(mediaProblems({ image: null }, { required: true }).image).toBe("Choose a picture.");
    expect(mediaProblems({ image: null })).toEqual({});
  });

  it("refuses a picture with no description", () => {
    expect(mediaProblems(image("")).alt).toBeDefined();
    expect(mediaProblems(image("   ")).alt).toBeDefined();
    expect(mediaProblems(image("A flat with a balcony"))).toEqual({});
  });

  it("limits the description to 125 characters", () => {
    expect(ALT_MAX).toBe(125);
    expect(mediaProblems(image("a".repeat(125)))).toEqual({});
    expect(mediaProblems(image("a".repeat(126))).alt).toContain("125");
  });
});

describe("record form helpers", () => {
  it("keeps the first zod message per field", () => {
    const schema = z.object({ title: z.string().min(5, "Write at least 5 characters."), price: z.number({ error: "Enter the price." }) });
    const result = schema.safeParse({ title: "ab", price: "x" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error.issues)).toEqual({ title: "Write at least 5 characters.", price: "Enter the price." });
  });

  it("names the fields that changed", () => {
    expect(changedFields({ a: 1, b: "x", c: null }, { a: 1, b: "y", c: undefined })).toEqual(["b"]);
    expect(changedFields({ a: 1 }, { a: 1, d: 5 })).toEqual(["d"]);
    expect(changedFields({ a: [1] }, { a: [1, 2] })).toEqual(["a"]);
  });
});

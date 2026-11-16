import { describe, expect, it } from "vitest";
import { coverOf, DEFAULT_COVER_FOCUS } from "@/components/new/blog-cover-data";

describe("blog cover from the blog record", () => {
  it("returns nothing when the record has no cover", () => {
    expect(coverOf({})).toBeNull();
    expect(coverOf({ cover: "  " })).toBeNull();
  });

  it("only accepts https addresses", () => {
    expect(coverOf({ cover: "http://example.com/a.jpg" })).toBeNull();
    expect(coverOf({ cover: "javascript:alert(1)" })).toBeNull();
    expect(coverOf({ cover: 'https://example.com/a.jpg" onerror="x' })).toBeNull();
  });

  it("keeps the address, the alt text and a valid focus point", () => {
    expect(coverOf({ cover: "https://res.cloudinary.com/x/a.jpg", coverAlt: " Two friends ", coverFocus: "60% 40%" })).toEqual({
      src: "https://res.cloudinary.com/x/a.jpg",
      alt: "Two friends",
      focus: "60% 40%",
    });
  });

  it("falls back to the default focus point when the value is not two percentages", () => {
    expect(coverOf({ cover: "https://a.test/a.jpg", coverFocus: "left top" })?.focus).toBe(DEFAULT_COVER_FOCUS);
    expect(coverOf({ cover: "https://a.test/a.jpg" })?.alt).toBe("");
  });
});

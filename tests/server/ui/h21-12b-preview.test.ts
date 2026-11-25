import { describe, expect, it } from "vitest";
import { CATEGORY_SLOTS, previewSlots, type PreviewHit } from "@/components/post/CategoryPreview";

const hit = (slug: string, variant: string): PreviewHit => ({ slug, title: slug, variant });

describe("H21.12b the preview rows", () => {
  it("holds Super Top 1, TOP 2 and all ads 3, with empty places where there is no real ad", () => {
    const slots = previewSlots([hit("a", "free"), hit("b", "top")], CATEGORY_SLOTS);
    expect(slots.super).toEqual([null]);
    expect(slots.top.map((item) => item?.slug ?? null)).toEqual(["b", null]);
    expect(slots.all.map((item) => item?.slug ?? null)).toEqual(["a", null, null]);
  });

  it("never moves a normal ad up into a boosted row, and cuts the extra ones", () => {
    const slots = previewSlots(["a", "b", "c", "d", "e"].map((slug) => hit(slug, "free")), CATEGORY_SLOTS);
    expect(slots.super).toEqual([null]);
    expect(slots.top).toEqual([null, null]);
    expect(slots.all.map((item) => item?.slug)).toEqual(["a", "b", "c"]);
  });
});

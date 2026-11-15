import { describe, expect, it } from "vitest";
import { activeFilterCount, listingFilterQuery } from "@/components/new/listing-filters";

const OFF = { verified: false, photos: false, video: false, online: false };

describe("Online now quick filter (H7.8)", () => {
  it("adds online=1 to the listing URL only when it is on", () => {
    expect(listingFilterQuery({}, { ...OFF, online: true })).toBe("online=1");
    expect(listingFilterQuery({}, OFF)).toBe("");
  });

  it("counts Online now in the active filter number", () => {
    expect(activeFilterCount([], { ...OFF, online: true, verified: true })).toBe(2);
    expect(activeFilterCount([], OFF)).toBe(0);
  });
});

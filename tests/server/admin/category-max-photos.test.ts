import { describe, expect, it } from "vitest";
import { cleanImportMaxPhotos } from "@/server/categories/manage";

describe("cleanImportMaxPhotos (Max photos for admin posts and imports)", () => {
  it("accepts whole numbers from 1 to 30", () => {
    expect(cleanImportMaxPhotos(1)).toBe(1);
    expect(cleanImportMaxPhotos("12")).toBe(12);
    expect(cleanImportMaxPhotos(30)).toBe(30);
  });

  it("stores a blank value as the default (null)", () => {
    expect(cleanImportMaxPhotos("")).toBeNull();
    expect(cleanImportMaxPhotos("   ")).toBeNull();
    expect(cleanImportMaxPhotos(null)).toBeNull();
    expect(cleanImportMaxPhotos(undefined)).toBeNull();
  });

  it("refuses 0, 31, fractions and text", () => {
    for (const value of [0, 31, -1, 2.5, "ten", "1e2"]) {
      expect(() => cleanImportMaxPhotos(value)).toThrow(/from 1 to 30/);
    }
  });
});

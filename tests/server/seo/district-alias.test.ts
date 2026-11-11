import { describe, expect, it } from "vitest";
import { isCityAlias, normalPlace } from "@/lib/seo/district-alias";

describe("district alias", () => {
  it("treats a district with the city's name as an alias", () => {
    expect(isCityAlias("Kolkata", "Kolkata District")).toBe(true);
    expect(isCityAlias("Surat", "Surat City")).toBe(true);
    expect(isCityAlias("Chennai", "Chennai")).toBe(true);
  });

  it("keeps real districts that are not the city", () => {
    expect(isCityAlias("Bengaluru", "Bengaluru Rural")).toBe(false);
    expect(isCityAlias("Visakhapatnam", "Choryasi")).toBe(false);
    expect(isCityAlias("Delhi", "Central Delhi")).toBe(false);
  });

  it("ignores case, spaces and the words district, city and urban", () => {
    expect(normalPlace("Kolkata-District")).toBe("kolkata");
    expect(normalPlace("New  Delhi Urban")).toBe("newdelhi");
  });

  it("never matches an empty name", () => {
    expect(isCityAlias("", "")).toBe(false);
  });
});

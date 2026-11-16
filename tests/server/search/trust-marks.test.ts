import { describe, expect, it } from "vitest";
import { trustMarks } from "@/server/search/query";

const ADULT = new Date("2020-01-01T00:00:00Z");

describe("trust marks (H7.66)", () => {
  it("shows Age verified only on people categories", () => {
    expect(trustMarks("approved", ADULT, false, 2, true)).toEqual(["ID verified", "Age verified", "Photo verified"]);
    expect(trustMarks("approved", ADULT, false, 2, false)).toEqual(["ID verified", "Photo verified"]);
  });

  it("shows nothing on a non-people ad of an unverified owner", () => {
    expect(trustMarks(undefined, undefined, false, 3, false)).toEqual([]);
  });

  it("shows Age verified for an attested adult on a people ad", () => {
    expect(trustMarks(undefined, ADULT, false, 0, true)).toEqual(["Age verified"]);
  });
});

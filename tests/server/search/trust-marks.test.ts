import { describe, expect, it } from "vitest";
import { trustMarks } from "@/server/search/query";

describe("trust marks (H7.66, H7.119)", () => {
  it("shows Age verified only on people categories", () => {
    expect(trustMarks("approved", false, 2, true)).toEqual(["ID verified", "Age verified", "Photo verified"]);
    expect(trustMarks("approved", false, 2, false)).toEqual(["ID verified", "Photo verified"]);
  });

  it("shows nothing on a non-people ad of an unverified owner", () => {
    expect(trustMarks(undefined, false, 3, false)).toEqual([]);
  });

  it("shows nothing on a people ad of an owner who verified nothing", () => {
    expect(trustMarks(undefined, false, 2, true)).toEqual([]);
    expect(trustMarks("unsubmitted", false, 2, true)).toEqual([]);
    expect(trustMarks("pending_review", false, 2, true)).toEqual([]);
    expect(trustMarks("rejected", false, 2, true)).toEqual([]);
  });

  it("shows Photo verified only when the ad has a photo", () => {
    expect(trustMarks("approved", false, 0, true)).toEqual(["ID verified", "Age verified"]);
  });

  it("follows the admin verified badge on the ad", () => {
    expect(trustMarks(undefined, true, 1, true)).toEqual(["ID verified", "Age verified", "Photo verified"]);
  });
});

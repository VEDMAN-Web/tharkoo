import { describe, expect, it } from "vitest";
import { ownTabCounts } from "@/server/listings/owner-cards";

describe("vendor panel tab counts (H6.19)", () => {
  it("counts every ad for All and each group for its tab", () => {
    expect(ownTabCounts(["active", "active", "pending", "expired", "draft", "archived"])).toEqual({
      all: 6,
      live: 2,
      review: 1,
      ended: 2,
      draft: 1,
    });
  });

  it("returns zeros for an owner with no ads", () => {
    expect(ownTabCounts([])).toEqual({ all: 0, live: 0, review: 0, ended: 0, draft: 0 });
  });
});

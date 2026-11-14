import { describe, expect, it } from "vitest";
import { OWNER_GROUPS, ownerGroupStatuses } from "@/server/listings/owner-groups";
import { listingQuerySchema } from "@/server/shared/schemas/listings";

describe("vendor panel tabs (H6.19)", () => {
  it("maps Live, In review and Ended to their statuses", () => {
    expect(ownerGroupStatuses("live")).toEqual(["active"]);
    expect(ownerGroupStatuses("review")).toEqual(["pending"]);
    expect(ownerGroupStatuses("ended")).toEqual(["expired", "archived"]);
  });

  it("accepts only the three groups in the query schema", () => {
    for (const group of OWNER_GROUPS) {
      expect(listingQuerySchema.parse({ group, page: "2", pageSize: "12" })).toMatchObject({ group, page: 2, pageSize: 12 });
    }
    expect(() => listingQuerySchema.parse({ group: "all" })).toThrow();
  });
});

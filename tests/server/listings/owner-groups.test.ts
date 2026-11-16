import { describe, expect, it } from "vitest";
import { DELETED_STATUSES, OWNER_GROUPS, ownerFilter, ownerGroupStatuses } from "@/server/listings/owner-groups";
import { listingQuerySchema } from "@/server/shared/schemas/listings";

describe("vendor panel tabs (H6.19)", () => {
  it("maps Live, In review and Ended to their statuses", () => {
    expect(ownerGroupStatuses("live")).toEqual(["active"]);
    expect(ownerGroupStatuses("review")).toEqual(["pending"]);
    expect(ownerGroupStatuses("ended")).toEqual(["expired", "archived"]);
  });

  it("keeps deleted ads out of every owner list, with or without a group", () => {
    expect(ownerFilter("u1", {})).toEqual({ ownerId: "u1", status: { $nin: [...DELETED_STATUSES] } });
    expect(ownerFilter("u1", { group: "ended" })).toEqual({ ownerId: "u1", status: { $in: ["expired", "archived"] } });
    expect(DELETED_STATUSES).toContain("removed");
  });

  it("accepts only the three groups in the query schema", () => {
    for (const group of OWNER_GROUPS) {
      expect(listingQuerySchema.parse({ group, page: "2", pageSize: "12" })).toMatchObject({ group, page: 2, pageSize: 12 });
    }
    expect(() => listingQuerySchema.parse({ group: "all" })).toThrow();
  });
});

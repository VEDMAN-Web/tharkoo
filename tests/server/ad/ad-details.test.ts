import { describe, expect, it } from "vitest";
import { adDetailRows } from "@/lib/ad-details";

const FIELDS = [
  { key: "purpose", label: "Purpose", order: 2 },
  { key: "kind", label: "Type", order: 1 },
  { key: "parking", label: "Parking", order: 3, enabled: false },
];

describe("adDetailRows (H7.9 F4)", () => {
  it("shows enabled category fields with the admin label, in the admin order", () => {
    const rows = adDetailRows({ purpose: "Rent", kind: "Apartment", parking: "Yes" }, FIELDS);
    expect(rows).toEqual([
      { label: "Type", value: "Apartment" },
      { label: "Purpose", value: "Rent" },
    ]);
  });

  it("never shows attributes the admin has not defined, such as the internal tag", () => {
    const rows = adDetailRows({ kind: "Plot", tag: "individual" }, FIELDS);
    expect(rows.map((row) => row.label)).toEqual(["Type"]);
  });

  it("skips empty values and returns nothing without a category or attributes", () => {
    expect(adDetailRows({ kind: "  ", purpose: "" }, FIELDS)).toEqual([]);
    expect(adDetailRows({ kind: "Plot" }, undefined)).toEqual([]);
    expect(adDetailRows(null, FIELDS)).toEqual([]);
  });
});

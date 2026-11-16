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

describe("adDetailRows number formatting (H7.99b)", () => {
  const fields = [
    { key: "km", label: "Driven", type: "number", unit: "km", order: 1 },
    { key: "year", label: "Year", type: "number", order: 2 },
    { key: "price", label: "Price", type: "number", order: 3 },
    { key: "deposit", label: "Deposit", type: "number", unit: "₹", order: 4 },
    { key: "size", label: "Size", type: "number", unit: "sq ft", order: 5 },
    { key: "model", label: "Model", type: "text", order: 6 },
  ];

  it("groups big numbers, keeps years plain, puts the rupee sign on money and adds the unit from the field", () => {
    const rows = adDetailRows({ km: 42000, year: 2019, price: 1250000, deposit: "50000", size: 1200, model: "2019 Edition" }, fields);
    expect(rows.map((row) => row.value)).toEqual(["42,000 km", "2019", "₹ 12,50,000", "₹ 50,000", "1,200 sq ft", "2019 Edition"]);
  });
});

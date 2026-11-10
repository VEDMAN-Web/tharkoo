import { describe, expect, it } from "vitest";
import {
  fieldDefinitionListSchema,
  parseListingAttributes,
  type FieldDefinition,
} from "@/server/shared/fields";

const fields: FieldDefinition[] = [
  {
    key: "make",
    label: "Make",
    type: "text",
    required: true,
    options: [],
    order: 1,
    enabled: true,
  },
  {
    key: "year",
    label: "Year",
    type: "number",
    required: true,
    options: [],
    min: 1900,
    max: 2100,
    order: 2,
    enabled: true,
  },
  {
    key: "km",
    label: "Distance",
    type: "number",
    required: false,
    options: [],
    min: 0,
    unit: "km",
    order: 3,
    enabled: true,
  },
  {
    key: "condition",
    label: "Condition",
    type: "select",
    required: true,
    options: ["New", "Used"],
    order: 4,
    enabled: true,
  },
  {
    key: "tags",
    label: "Tags",
    type: "multiselect",
    required: false,
    options: ["Warranty", "Delivery"],
    order: 5,
    enabled: true,
  },
  {
    key: "available",
    label: "Available",
    type: "boolean",
    required: false,
    options: [],
    order: 6,
    enabled: true,
  },
  {
    key: "purchased",
    label: "Purchased",
    type: "date",
    required: false,
    options: [],
    order: 7,
    enabled: true,
  },
  {
    key: "budget",
    label: "Budget",
    type: "range",
    required: false,
    options: [],
    min: 0,
    max: 100000,
    order: 8,
    enabled: true,
  },
  {
    key: "internal",
    label: "Internal",
    type: "text",
    required: true,
    options: [],
    order: 9,
    enabled: false,
  },
];

const valid = {
  make: "Honda",
  year: 2018,
  km: 42000,
  condition: "Used",
  tags: ["Warranty"],
  available: true,
  purchased: "2020-05-01",
  budget: { min: 1000, max: 5000 },
};

describe("listing field validation", () => {
  it("accepts values that match the field definitions", () => {
    expect(parseListingAttributes(fields, valid)).toMatchObject(valid);
  });

  it("rejects a missing required field, a bad type, a range, and an unknown option", () => {
    expect(() => parseListingAttributes(fields, { ...valid, make: "" })).toThrow();
    expect(() => parseListingAttributes(fields, { ...valid, year: "2018" })).toThrow();
    expect(() => parseListingAttributes(fields, { ...valid, year: 1800 })).toThrow();
    expect(() => parseListingAttributes(fields, { ...valid, condition: "Broken" })).toThrow();
    expect(() =>
      parseListingAttributes(fields, { ...valid, budget: { min: 9, max: 1 } }),
    ).toThrow();
    expect(() => parseListingAttributes(fields, { ...valid, extra: true })).toThrow();
  });

  it("does not require a disabled field and rejects a value for it", () => {
    const { make, year, condition } = valid;
    expect(parseListingAttributes(fields, { make, year, condition }).internal).toBeUndefined();
    expect(() => parseListingAttributes(fields, { ...valid, internal: "secret" })).toThrow();
  });

  it("rejects a select field that has no options and a prohibited field key", () => {
    expect(
      fieldDefinitionListSchema.safeParse([
        {
          key: "condition",
          label: "Condition",
          type: "select",
          required: true,
          options: [],
          order: 1,
          enabled: true,
        },
      ]).success,
    ).toBe(false);
    expect(
      fieldDefinitionListSchema.safeParse([
        {
          key: "hourly_rate",
          label: "Hourly rate",
          type: "number",
          required: false,
          options: [],
          order: 1,
          enabled: true,
        },
      ]).success,
    ).toBe(false);
  });
});

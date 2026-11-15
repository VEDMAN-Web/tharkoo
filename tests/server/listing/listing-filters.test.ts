import { describe, expect, it } from "vitest";
import { activeFilterCount, filterRows, hasFieldPicks, listingFilterQuery } from "@/components/new/listing-filters";
import { bandImageFor, bandStyleFor } from "@/components/new/band-image";
import { parseFieldFilters } from "@/server/search/filter-seo";

const fields = [
  { key: "hair", label: "Hair colour", type: "multiselect", options: ["Black", "Brown"], filterable: true, enabled: true, order: 2 },
  { key: "looking", label: "Looking for", type: "select", options: ["Dating", "Friendship"], optionLabels: { Dating: "Dating" }, filterable: true, order: 1 },
  { key: "bio", label: "Bio", type: "text", options: [], filterable: true, enabled: true },
  { key: "age", label: "Age", type: "range", filterable: true, enabled: true },
  { key: "tall", label: "Tall", type: "multiselect", options: ["Yes"], filterable: false, enabled: true },
  { key: "hidden", label: "Hidden", type: "multiselect", options: ["X"], filterable: true, enabled: false },
];

describe("filterRows", () => {
  it("lists only enabled, filterable pick fields that have options, in admin order", () => {
    const rows = filterRows(fields, {});
    expect(rows.map((row) => row.key)).toEqual(["looking", "hair"]);
  });

  it("marks the picked options and counts them per row", () => {
    const rows = filterRows(fields, { hair: ["Brown", "Purple"], looking: ["Dating"] });
    const hair = rows.find((row) => row.key === "hair");
    expect(hair?.picked).toBe(1);
    expect(hair?.options.map((option) => option.picked)).toEqual([false, true]);
    expect(rows.find((row) => row.key === "looking")?.picked).toBe(1);
  });

  it("uses the option label when the field has one", () => {
    const rows = filterRows(fields, {});
    expect(rows[0].options.map((option) => option.label)).toEqual(["Dating", "Friendship"]);
  });

  it("returns no rows for a category without fields", () => {
    expect(filterRows(undefined, {})).toEqual([]);
  });
});

describe("activeFilterCount", () => {
  it("adds every pick and each quick toggle that is on", () => {
    const rows = filterRows(fields, { hair: ["Black", "Brown"], looking: ["Dating"] });
    expect(activeFilterCount(rows, { verified: true, photos: false })).toBe(4);
    expect(activeFilterCount(rows, { verified: false, photos: false })).toBe(3);
  });
});

describe("listingFilterQuery", () => {
  it("builds the f. parameters and the toggles, and nothing when all are off", () => {
    const query = listingFilterQuery({ hair: ["Black", "Brown"] }, { verified: true, photos: true });
    expect(query).toBe("f.hair=Black&f.hair=Brown&verified=1&photos=1");
    expect(listingFilterQuery({}, { verified: false, photos: false })).toBe("");
  });

  it("round-trips through parseFieldFilters, keeping every pick", () => {
    const query = listingFilterQuery({ hair: ["Black", "Brown"], looking: ["Dating"] }, { verified: false, photos: false });
    const params: Record<string, string[]> = {};
    new URLSearchParams(query).forEach((value, key) => {
      params[key] = [...(params[key] ?? []), value];
    });
    expect(parseFieldFilters(params)).toEqual({ hair: ["Black", "Brown"], looking: ["Dating"] });
  });
});

describe("hasFieldPicks", () => {
  it("is false when every pick list is empty", () => {
    expect(hasFieldPicks({ hair: [] })).toBe(false);
    expect(hasFieldPicks({ hair: ["Black"] })).toBe(true);
  });
});

describe("bandImageFor and bandStyleFor", () => {
  const shell = {
    media: {
      images: [
        { scope: "category", slug: "dating", band: "https://cdn.example/dating.jpg", bandPhone: "" },
        { scope: "city", slug: "pune", band: "", bandPhone: "https://cdn.example/pune-phone.jpg" },
      ],
    },
  } as unknown as Parameters<typeof bandImageFor>[0];

  it("prefers the city image, then the category image, then none", () => {
    expect(bandImageFor(shell, "dating", "pune")?.bandPhone).toBe("https://cdn.example/pune-phone.jpg");
    expect(bandImageFor(shell, "dating", "mumbai")?.band).toBe("https://cdn.example/dating.jpg");
    expect(bandImageFor(shell, "property")).toBeNull();
  });

  it("does not match a city image when there is no city", () => {
    expect(bandImageFor(shell, "dating")?.scope).toBe("category");
  });

  it("sets the computer and phone variables, and falls back to the computer image for the phone", () => {
    expect(bandStyleFor(bandImageFor(shell, "dating"))).toEqual({
      "--band-desk": 'url("https://cdn.example/dating.jpg")',
      "--band-phone": 'url("https://cdn.example/dating.jpg")',
    });
    expect(bandStyleFor(null)).toEqual({});
  });
});

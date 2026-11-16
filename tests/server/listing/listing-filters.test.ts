import { describe, expect, it } from "vitest";
import { activeFilterCount, attributePicks, filterableFields, hasFieldPicks, listingFilterQuery, panelRows } from "@/components/new/listing-filters";
import { bandImageFor, bandStyleFor } from "@/components/new/band-image";
import { parseFieldFilters } from "@/server/search/filter-seo";

const fields = [
  { key: "hair", label: "Hair colour", type: "multiselect", options: ["Black", "Brown"], filterable: true, enabled: true, order: 2 },
  { key: "looking", label: "Looking for", type: "select", options: ["Dating", "Friendship"], optionLabels: { Dating: "Dating" }, filterable: true, order: 1 },
  { key: "bio", label: "Bio", type: "text", options: [], filterable: true, enabled: true },
  { key: "age", label: "Age", type: "range", filterable: true, enabled: true, order: 3 },
  { key: "smoker", label: "Smoker", type: "boolean", filterable: true, enabled: true, order: 4 },
  { key: "tall", label: "Tall", type: "multiselect", options: ["Yes"], filterable: false, enabled: true },
  { key: "hidden", label: "Hidden", type: "multiselect", options: ["X"], filterable: true, enabled: false },
];
const none = { verified: false, photos: false, video: false };

describe("filterableFields", () => {
  it("keeps enabled, filterable fields in admin order", () => {
    expect(filterableFields(fields).map((field) => field.key)).toEqual(["bio", "looking", "hair", "age", "smoker"]);
  });
});

describe("attributePicks", () => {
  it("reads a hyphenated field key through the shared parser", () => {
    const hyphen = [{ key: "looking-for", label: "Looking for", type: "select", options: ["Dating", "Friendship"], filterable: true, enabled: true }];
    expect(attributePicks({ "f.looking-for": "Dating", "f.looking-for_extra": "x" }, hyphen)).toEqual({ "looking-for": ["Dating"] });
  });

  it("reads chips, a number range and a yes/no chip, and drops keys the category does not offer", () => {
    const picks = attributePicks(
      { "f.hair": ["Brown", "Purple"], "f.age_min": "25", "f.age_max": "40", "f.smoker": "1", "f.tall": "Yes", "f.nope": "x" },
      fields,
    );
    expect(picks).toEqual({ hair: ["Brown"], age: { min: 25, max: 40 }, smoker: ["1"] });
  });

  it("ignores empty or non-numeric range bounds", () => {
    expect(attributePicks({ "f.age_min": "", "f.age_max": "abc" }, fields)).toEqual({});
    expect(attributePicks({ "f.age_max": "40" }, fields)).toEqual({ age: { max: 40 } });
  });
});

describe("panelRows", () => {
  it("builds a row per filter field with the right kind and the current picks", () => {
    const picks = attributePicks({ "f.hair": ["Black"], "f.age_min": "18", "f.smoker": "1" }, fields);
    const rows = panelRows(fields, picks);
    expect(rows.map((row) => row.kind)).toEqual(["choice", "choice", "range", "boolean"]);
    const hair = rows.find((row) => row.key === "hair");
    expect(hair && hair.kind === "choice" && hair.options.map((option) => option.picked)).toEqual([true, false]);
    const age = rows.find((row) => row.key === "age");
    expect(age && age.kind === "range" && [age.min, age.max, age.picked]).toEqual(["18", "", 1]);
    expect(rows.find((row) => row.key === "smoker")?.picked).toBe(1);
  });

  it("returns no rows when the category has no filter fields", () => {
    expect(panelRows(undefined, {})).toEqual([]);
  });
});

describe("activeFilterCount", () => {
  it("adds every pick and each quick toggle that is on", () => {
    const picks = attributePicks({ "f.hair": ["Black", "Brown"], "f.smoker": "1" }, fields);
    const rows = panelRows(fields, picks);
    expect(activeFilterCount(rows, { verified: true, photos: false, video: true })).toBe(5);
    expect(activeFilterCount(rows, none)).toBe(3);
  });
});

describe("listingFilterQuery", () => {
  it("builds the f. parameters and the toggles, and nothing when all are off", () => {
    const picks = { hair: ["Black", "Brown"], age: { min: 25, max: 40 } };
    expect(listingFilterQuery(picks, { verified: true, photos: true, video: false })).toBe("f.hair=Black&f.hair=Brown&f.age_min=25&f.age_max=40&verified=1&photos=1");
    expect(listingFilterQuery({}, none)).toBe("");
    expect(listingFilterQuery({}, { ...none, video: true })).toBe("video=1");
  });

  it("round-trips through the URL, keeping every pick", () => {
    const picks = { hair: ["Black", "Brown"], age: { min: 25 }, smoker: ["1"] };
    const params: Record<string, string[]> = {};
    new URLSearchParams(listingFilterQuery(picks, none)).forEach((value, key) => {
      params[key] = [...(params[key] ?? []), value];
    });
    expect(attributePicks(params, fields)).toEqual(picks);
    expect(parseFieldFilters(params).hair).toEqual(["Black", "Brown"]);
  });
});

describe("hasFieldPicks", () => {
  it("is false when there are no picks", () => {
    expect(hasFieldPicks({})).toBe(false);
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
      "--band-focus-phone": "72% 22%",
    });
    expect(bandStyleFor(null)).toEqual({});
  });
});

describe("attributePicks with hyphenated field keys", () => {
  it("reads f.<key> for a key with a hyphen and keeps only the offered options", () => {
    const hyphen = [{ key: "looking-for", label: "Looking for", type: "select", options: ["Dating", "Friendship"], filterable: true, enabled: true }];
    expect(attributePicks({ "f.looking-for": ["Dating", "Other"] }, hyphen)).toEqual({ "looking-for": ["Dating"] });
  });
});

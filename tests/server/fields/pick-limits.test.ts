import { describe, expect, it } from "vitest";
import { choiceProblems, parseListingAttributes, pickLimitOf, DEFAULT_MAX_PICKS, type FieldDefinition } from "@/server/shared/fields";
import { togglePick, visibleOptions, PICK_SHOW_LIMIT } from "@/lib/ui/pick-options";

function field(overrides: Partial<FieldDefinition> & Pick<FieldDefinition, "key" | "type">): FieldDefinition {
  return { label: overrides.key, required: false, options: [], order: 0, enabled: true, ...overrides };
}

const colours = Array.from({ length: 30 }, (_, index) => `Colour ${index + 1}`);
const hair = field({ key: "hair", type: "multiselect", options: colours, maxPicks: 3 });
const looking = field({ key: "looking", type: "multiselect", options: ["Friendship", "Dating"] });
const size = field({ key: "size", type: "select", options: ["Small", "Large"] });

describe("pick limits on the server", () => {
  it("uses the admin limit when one is set and the default otherwise", () => {
    expect(pickLimitOf(hair)).toBe(3);
    expect(pickLimitOf(looking)).toBe(DEFAULT_MAX_PICKS);
    expect(pickLimitOf({ maxPicks: null })).toBe(DEFAULT_MAX_PICKS);
  });

  it("refuses more picks than the limit when the listing is saved", () => {
    expect(() => parseListingAttributes([hair], { hair: ["Colour 1", "Colour 2", "Colour 3", "Colour 4"] })).toThrow();
    expect(parseListingAttributes([hair], { hair: ["Colour 1", "Colour 2", "Colour 3"] })).toEqual({ hair: ["Colour 1", "Colour 2", "Colour 3"] });
  });

  it("reports a value that is not in the admin list and an over-limit pick on a draft", () => {
    const problems = choiceProblems([hair, size], { hair: ["Colour 1", "Colour 2", "Colour 3", "Colour 4"], size: "Huge" });
    expect(problems).toEqual({ hair: ["Choose up to 3"], size: ["Choose a listed option"] });
  });

  it("lets a draft carry empty answers and skips keys that are not fields", () => {
    expect(choiceProblems([hair, size], { hair: [], size: "", other: "anything" })).toEqual({});
  });

  it("refuses a pick-many value that is not listed", () => {
    expect(choiceProblems([looking], { looking: ["Dating", "Chess"] })).toEqual({ looking: ["Choose listed options"] });
  });
});

describe("chip helpers", () => {
  it("adds a pick until the limit, then stops", () => {
    let picks: string[] = [];
    for (const option of ["A", "B", "C", "D"]) picks = togglePick(picks, option, "many", 3);
    expect(picks).toEqual(["A", "B", "C"]);
  });

  it("removes a pick when it is pressed again", () => {
    expect(togglePick(["A", "B"], "A", "many", 3)).toEqual(["B"]);
  });

  it("keeps one pick for a pick-one field", () => {
    expect(togglePick(["A"], "B", "one", 1)).toEqual(["B"]);
    expect(togglePick(["B"], "B", "one", 1)).toEqual([]);
  });

  it("draws the picks first, then the matches, up to the show limit", () => {
    const many = Array.from({ length: 200 }, (_, index) => `Item ${index}`);
    const shown = visibleOptions(many, ["Item 150"], "");
    expect(shown.chips[0]).toBe("Item 150");
    expect(shown.chips).toHaveLength(PICK_SHOW_LIMIT);
    expect(shown.matches).toBe(200);
  });

  it("filters by the search text, without case", () => {
    const shown = visibleOptions(["Blonde", "Brunette", "Black"], [], "BL");
    expect(shown.chips).toEqual(["Blonde", "Black"]);
    expect(shown.matches).toBe(2);
  });
});

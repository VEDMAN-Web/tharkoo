import { describe, expect, it } from "vitest";
import { SEARCH_FROM, matchOptions, placeChoices } from "@/components/ui/SearchSelect";

/** H16.1c: the matching rules of the type-ahead city box. */

const options = [
  { value: "1", label: "Pune" },
  { value: "2", label: "Punalur" },
  { value: "3", label: "Kapurthala" },
  { value: "4", label: "Ahmednagar" },
  { value: "5", label: "Mumbai" },
];

describe("H16.1c matching what was typed", () => {
  it("puts names that start with the letters first, then names that contain them, ignoring case and spaces at the ends", () => {
    expect(matchOptions(options, "  PUN ").map((item) => item.label)).toEqual(["Pune", "Punalur"]);
    expect(matchOptions(options, "pu").map((item) => item.label)).toEqual(["Pune", "Punalur", "Kapurthala"]);
    expect(matchOptions(options, "nagar").map((item) => item.label)).toEqual(["Ahmednagar"]);
  });

  it("shows the first choices when nothing is typed, and never more than the limit", () => {
    const many = Array.from({ length: 900 }, (_, index) => ({ value: String(index), label: `Town ${index}` }));
    expect(matchOptions(many, "")).toHaveLength(40);
    expect(matchOptions(many, "town")).toHaveLength(40);
    expect(matchOptions(many, "town 8", 5)).toHaveLength(5);
    expect(matchOptions(many, "no such place")).toEqual([]);
  });

  it("also finds a place by its state when the state is shown beside the name", () => {
    const twins = placeChoices(
      [
        { id: "a", name: "Aurangabad", stateSlug: "bihar" },
        { id: "b", name: "Aurangabad", stateSlug: "maharashtra" },
        { id: "c", name: "Pune", stateSlug: "maharashtra" },
      ],
      (item) => item.id,
    );
    expect(matchOptions(twins, "maha").map((item) => item.value)).toEqual(["b"]);
  });
});

describe("H16.1c place choices", () => {
  it("shows the state only beside names that more than one place has", () => {
    const choices = placeChoices(
      [
        { name: "Aurangabad", stateSlug: "bihar", id: "a" },
        { name: "Aurangabad", stateSlug: "maharashtra", id: "b" },
        { name: "Surat", stateSlug: "gujarat", id: "c" },
        { name: "Pune", id: "d" },
      ],
      (item) => item.id,
    );
    expect(choices).toEqual([
      { value: "a", label: "Aurangabad", hint: "Bihar" },
      { value: "b", label: "Aurangabad", hint: "Maharashtra" },
      { value: "c", label: "Surat", hint: undefined },
      { value: "d", label: "Pune", hint: undefined },
    ]);
  });

  it("a list switches to the type-ahead above 100 choices", () => {
    expect(SEARCH_FROM).toBe(100);
  });
});

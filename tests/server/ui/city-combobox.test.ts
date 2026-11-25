import { describe, expect, it } from "vitest";
import { matchCities } from "@/components/post/CityCombobox";

const cities = [
  { id: "1", name: "Bardoli", stateSlug: "gujarat" },
  { id: "2", name: "Bardhaman", stateSlug: "west-bengal" },
  { id: "3", name: "Barddez", stateSlug: "goa" },
  { id: "4", name: "Sabarmati", stateSlug: "gujarat" },
  { id: "5", name: "Mumbai", stateSlug: "maharashtra" },
];

describe("city box", () => {
  it("matches the first letters first, then names that contain them, across every state", () => {
    expect(matchCities(cities, "bard").map((city) => city.id)).toEqual(["1", "2", "3"]);
    expect(matchCities(cities, "bar").map((city) => city.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("is not case sensitive and shows nothing for empty or unknown text", () => {
    expect(matchCities(cities, "MUM")).toHaveLength(1);
    expect(matchCities(cities, "  ")).toEqual([]);
    expect(matchCities(cities, "zzqq")).toEqual([]);
  });

  it("shows at most the limit", () => {
    expect(matchCities(cities, "a", 2)).toHaveLength(2);
  });
});

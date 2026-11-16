import { describe, expect, it } from "vitest";
import { searchPlaceSelects } from "@/components/new/listing-frame-props";
import { narrowFromParams } from "@/components/new/listing-narrow";
import type { ListingLabels } from "@/components/new/listing-filters";

const labels = { all: "All", allStates: "All states", allCities: "All cities", allAreas: "All areas" } as ListingLabels;
const lists = {
  searchPath: "/search/",
  categories: [{ slug: "dating", name: "Dating" }],
  states: [{ slug: "gujarat", name: "Gujarat" }],
  cities: [
    { slug: "surat", name: "Surat", stateSlug: "gujarat" },
    { slug: "pune", name: "Pune", stateSlug: "maharashtra" },
  ],
  districts: [{ slug: "choryasi", name: "Choryasi" }],
  labels,
};

describe("searchPlaceSelects", () => {
  it("keeps the search words and the other picks in every link", () => {
    const places = searchPlaceSelects({ ...lists, params: { q: "coffee", city: "surat", state: "gujarat" } });
    expect(places.categories.find((option) => option.value === "dating")?.href).toBe("/search/?q=coffee&city=surat&state=gujarat&category=dating");
    expect(places.categories[0].href).toBe("/search/?q=coffee&city=surat&state=gujarat");
  });

  it("clears the city and the area when the state changes, and the area when the city changes", () => {
    const places = searchPlaceSelects({ ...lists, params: { city: "surat", state: "gujarat", area: "choryasi" } });
    expect(places.states[0].href).toBe("/search/");
    expect(places.states.find((option) => option.value === "gujarat")?.href).toBe("/search/?state=gujarat");
    expect(places.cities.find((option) => option.value === "surat")?.href).toBe("/search/?city=surat&state=gujarat");
  });

  it("lists only the cities of the chosen state and offers areas only once a city is chosen", () => {
    const withState = searchPlaceSelects({ ...lists, params: { state: "gujarat" } });
    expect(withState.cities.map((option) => option.value)).toEqual(["", "surat"]);
    expect(withState.areas).toEqual([]);
    const withCity = searchPlaceSelects({ ...lists, params: { city: "surat" } });
    expect(withCity.areas.map((option) => option.value)).toEqual(["", "choryasi"]);
    expect(withCity.cityValue).toBe("surat");
  });
});

describe("narrowFromParams", () => {
  it("turns the quick toggles into a feed filter and nothing else when none is on", () => {
    expect(narrowFromParams({}, undefined).filter).toEqual({});
    const on = narrowFromParams({ verified: "1", photos: "1", video: "1", online: "1" }, undefined);
    expect(on.toggles).toEqual({ verified: true, photos: true, video: true, online: true });
    expect(on.filter).toMatchObject({ verified: true, video: true, online: true });
    expect(on.filter).toHaveProperty("photos");
  });
});

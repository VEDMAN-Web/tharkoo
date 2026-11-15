import { describe, expect, it } from "vitest";
import type { LocationRow } from "@/server/locations/service";
import { countryOptionsFrom, pickSiteCountry, placesOfCountry } from "@/server/locations/country-scope";

const rows = [
  { _id: "c-in", type: "country", slug: "india", name: "India", countryCode: "IN", order: 1 },
  { _id: "c-us", type: "country", slug: "usa", name: "USA", countryCode: "US", order: 2 },
  { _id: "s-gj", type: "state", slug: "gujarat", name: "Gujarat", parentId: "c-in" },
  { _id: "s-tx", type: "state", slug: "texas", name: "Texas", parentId: "c-us" },
  { _id: "ct-surat", type: "city", slug: "surat", name: "Surat", parentId: "s-gj" },
  { _id: "ct-dal", type: "city", slug: "dallas", name: "Dallas", parentId: "s-tx" },
  { _id: "ct-old", type: "city", slug: "old", name: "Old", parentId: "s-gj", enabled: false },
] as unknown as (LocationRow & { countryCode?: string })[];

describe("country options", () => {
  it("lists enabled countries in admin order", () => {
    expect(countryOptionsFrom(rows).map((option) => option.slug)).toEqual(["india", "usa"]);
  });
});

describe("pickSiteCountry", () => {
  const options = countryOptionsFrom(rows);
  it("uses the cookie country when it is enabled, else India, else the first", () => {
    expect(pickSiteCountry(options, "usa")?.slug).toBe("usa");
    expect(pickSiteCountry(options, "nowhere")?.slug).toBe("india");
    expect(pickSiteCountry(options, undefined)?.slug).toBe("india");
  });
});

describe("placesOfCountry", () => {
  it("keeps only the chosen country's enabled states and cities, with each city's state", () => {
    const india = placesOfCountry(rows, "india");
    expect(india.states).toEqual([{ slug: "gujarat", name: "Gujarat", stateSlug: "" }]);
    expect(india.cities).toEqual([{ slug: "surat", name: "Surat", stateSlug: "gujarat" }]);
  });

  it("never shows another country's places", () => {
    const usa = placesOfCountry(rows, "usa");
    expect(usa.cities.map((city) => city.slug)).toEqual(["dallas"]);
    expect(usa.states.map((state) => state.slug)).toEqual(["texas"]);
  });
});

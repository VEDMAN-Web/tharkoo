import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { scopeToCountry } from "@/components/new/ListingPlaceSelects";
import { placeSelects } from "@/components/new/listing-frame-props";
import type { ListingLabels } from "@/components/new/listing-filters";
import { countryOptionsFrom, pickSiteCountry } from "@/server/locations/country-scope";
import { codeOf } from "@/server/locations/flag";

const labels = {
  allStates: "All states",
  allCities: "All cities",
  allAreas: "All areas",
} as ListingLabels;

describe("H7.4d: SVG country flags", () => {
  it("draws an inline SVG 16 x 12 for a known code, never an emoji", () => {
    const html = renderToStaticMarkup(createElement(CountryFlag, { code: "in" }));
    expect(html).toContain("<svg");
    expect(html).toContain('width="16"');
    expect(html).toContain('height="12"');
    expect(html).toContain('rx="2"');
    expect(html).not.toMatch(/\u{1F1EE}|\u{1F1F3}/u);
  });

  it("shows a neutral globe, not letters, for a country without a drawing", () => {
    const html = renderToStaticMarkup(createElement(CountryFlag, { code: "ZZ" }));
    expect(html).toContain("tkn-flag-none");
    expect(html).not.toContain("clipPath");
  });

  it("takes the ISO code from a country row (upper case, or empty when not two letters)", () => {
    expect(codeOf("in")).toBe("IN");
    expect(codeOf("IND")).toBe("");
    expect(codeOf(undefined)).toBe("");
    const [india] = countryOptionsFrom([{ type: "country", slug: "india", name: "India", countryCode: "in" } as never]);
    expect(india).toMatchObject({ slug: "india", code: "IN" });
  });
});

describe("H7.4d: place selects follow the site country", () => {
  const states = [
    { slug: "goa", name: "Goa", countrySlug: "india" },
    { slug: "texas", name: "Texas", countrySlug: "usa" },
  ];
  const cities = [
    { slug: "panaji", name: "Panaji", countrySlug: "india" },
    { slug: "austin", name: "Austin", countrySlug: "usa" },
  ];
  const selects = placeSelects({ categorySlug: "dating", categories: [], states, cities, districts: [], labels });

  it("carries each state and city's country onto its option", () => {
    expect(selects.states.find((option) => option.value === "texas")?.country).toBe("usa");
    expect(selects.cities.find((option) => option.value === "panaji")?.country).toBe("india");
  });

  it("shows only the site country's places, and keeps the 'All' entry", () => {
    const visible = scopeToCountry(selects.states, "india", "").map((option) => option.value);
    expect(visible).toEqual(["", "goa"]);
  });

  it("keeps the current place visible even when it is in another country", () => {
    const visible = scopeToCountry(selects.cities, "india", "austin").map((option) => option.value);
    expect(visible).toEqual(["", "panaji", "austin"]);
  });

  it("leaves the list whole when no place belongs to the site country", () => {
    expect(scopeToCountry(selects.states, "uk", "").map((option) => option.value)).toEqual(["", "goa", "texas"]);
  });

  it("uses the cookie's country when it is enabled, else India", () => {
    const options = countryOptionsFrom([
      { type: "country", slug: "usa", name: "USA", countryCode: "US", order: 1 },
      { type: "country", slug: "india", name: "India", countryCode: "IN", order: 2 },
    ] as never);
    expect(pickSiteCountry(options, "usa")?.slug).toBe("usa");
    expect(pickSiteCountry(options, "nope")?.slug).toBe("india");
  });
});

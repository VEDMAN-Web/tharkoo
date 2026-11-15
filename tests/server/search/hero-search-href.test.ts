import { describe, expect, it } from "vitest";
import { DEFAULT_PATHS } from "@/lib/urls";
import { heroSearchHref } from "@/components/new/hero-search-href";

describe("heroSearchHref", () => {
  const paths = DEFAULT_PATHS;

  it("goes to the category, the category and city, or the category and state hub", () => {
    expect(heroSearchHref(paths, { category: "buy-and-sell" })).toBe("/buy-and-sell/");
    expect(heroSearchHref(paths, { category: "buy-and-sell", city: "surat" })).toBe("/buy-and-sell/surat/");
    expect(heroSearchHref(paths, { category: "buy-and-sell", state: "gujarat" })).toBe("/buy-and-sell/gujarat/");
  });

  it("uses the city page without a category, and the cities page for a state alone", () => {
    expect(heroSearchHref(paths, { city: "surat" })).toBe("/cities/surat/");
    expect(heroSearchHref(paths, { state: "gujarat" })).toBe("/cities/");
  });

  it("goes to search when nothing is picked", () => {
    expect(heroSearchHref(paths, {})).toBe("/search/");
  });
});

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

  it("uses the city page without a category", () => {
    expect(heroSearchHref(paths, { city: "surat" })).toBe("/cities/surat/");
  });

  it("goes to the search page filtered to the state for a state alone", () => {
    expect(heroSearchHref(paths, { state: "gujarat" })).toBe("/search/?state=gujarat");
  });

  it("goes to search when nothing is picked", () => {
    expect(heroSearchHref(paths, {})).toBe("/search/");
  });
});

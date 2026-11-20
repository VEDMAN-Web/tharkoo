import { describe, expect, it } from "vitest";
import { nearbyCities, popularSearches, type CountRow } from "@/lib/seo/local-links";

/** H17.4: Nearby is the same state only; Popular searches are real category + city pages that have ads. */

const cities = [
  { slug: "surat", name: "Surat", stateSlug: "gujarat" },
  { slug: "vadodara", name: "Vadodara", stateSlug: "gujarat" },
  { slug: "rajkot", name: "Rajkot", stateSlug: "gujarat" },
  { slug: "ahmedabad", name: "Ahmedabad", stateSlug: "gujarat" },
  { slug: "bhuj", name: "Bhuj", stateSlug: "gujarat" },
  { slug: "anand", name: "Anand", stateSlug: "gujarat" },
  { slug: "pune", name: "Pune", stateSlug: "maharashtra" },
  { slug: "mumbai", name: "Mumbai", stateSlug: "maharashtra" },
  { slug: "delhi", name: "Delhi", stateSlug: "delhi" },
  { slug: "nowhere" , name: "Nowhere" },
];

const row = (categorySlug: string, citySlug: string, n: number): CountRow => ({ _id: { categorySlug, citySlug }, n });

describe("H17.4 Nearby cities", () => {
  it("lists only cities of the same state, never itself and never another state", () => {
    const found = nearbyCities(cities[0], cities, [row("dating", "pune", 900)], "dating", 10);
    expect(found.map((city) => city.slug).sort()).toEqual(["ahmedabad", "anand", "bhuj", "rajkot", "vadodara"]);
    expect(found.every((city) => city.stateSlug === "gujarat")).toBe(true);
  });

  it("puts the cities with the most ads in this category first, then by name, and stops at the limit", () => {
    const counts = [row("dating", "rajkot", 7), row("dating", "vadodara", 3), row("jobs", "bhuj", 99)];
    expect(nearbyCities(cities[0], cities, counts, "dating", 3).map((city) => city.slug)).toEqual(["rajkot", "vadodara", "ahmedabad"]);
  });

  it("gives nothing when the state is not known, and nothing for a state with one city", () => {
    expect(nearbyCities(cities[9], cities, [], "dating")).toEqual([]);
    expect(nearbyCities(cities[8], cities, [], "dating")).toEqual([]);
  });
});

describe("H17.4 Popular searches", () => {
  const categories = new Map([["dating", "Dating"], ["jobs", "Jobs"], ["property", "Property"]]);
  const names = new Map(cities.map((city) => [city.slug, city.name]));

  it("is built only from category and city pairs that have ads, the biggest first, one per city", () => {
    const counts = [row("dating", "mumbai", 50), row("jobs", "mumbai", 40), row("jobs", "pune", 30), row("property", "surat", 0), row("dating", "ghost", 10)];
    const links = popularSearches(counts, categories, names);
    expect(links.map((link) => `${link.categorySlug}/${link.citySlug}`)).toEqual(["dating/mumbai", "jobs/pune"]);
  });

  it("leaves out the page being shown, and a whole category when asked", () => {
    const counts = [row("dating", "surat", 50), row("jobs", "surat", 40), row("jobs", "pune", 30), row("dating", "mumbai", 20)];
    expect(popularSearches(counts, categories, names, { excludePage: { categorySlug: "dating", citySlug: "surat" } }).map((link) => `${link.categorySlug}/${link.citySlug}`)).toEqual(["jobs/surat", "jobs/pune", "dating/mumbai"]);
    expect(popularSearches(counts, categories, names, { excludeCategory: "dating" }).map((link) => `${link.categorySlug}/${link.citySlug}`)).toEqual(["jobs/surat", "jobs/pune"]);
  });

  it("never makes up a phrase: every link is a category name and a city name", () => {
    const links = popularSearches([row("property", "pune", 5)], categories, names);
    expect(links).toEqual([{ categorySlug: "property", citySlug: "pune", categoryName: "Property", cityName: "Pune", n: 5 }]);
  });
});

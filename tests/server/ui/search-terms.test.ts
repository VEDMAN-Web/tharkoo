import { describe, expect, it } from "vitest";
import { expandSearchTerms } from "@/server/search/query";

describe("search terms", () => {
  it("expands flat and job words without caring about case", () => {
    const flat = expandSearchTerms("Flat").flat();
    expect(flat).toEqual(expect.arrayContaining(["flat", "apartment", "rent"]));
    const hiring = expandSearchTerms("HIRING").flat();
    expect(hiring).toEqual(expect.arrayContaining(["hiring", "job", "jobs", "vacancy"]));
    const jobs = expandSearchTerms("jobs").flat();
    expect(jobs).toEqual(expect.arrayContaining(["job", "jobs", "hiring", "vacancy"]));
  });
});

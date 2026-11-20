import { describe, expect, it } from "vitest";
import { adAddress, generateAdCode, isAdCode, parseAdRoute, splitAdSegment } from "@/lib/ad-address";

describe("H16.2 ad code", () => {
  it("makes 5 lowercase base36 characters with at least one digit, every time", () => {
    for (let i = 0; i < 2000; i += 1) {
      const code = generateAdCode();
      expect(code).toMatch(/^[a-z0-9]{5}$/);
      expect(code).toMatch(/\d/);
    }
  });

  it("forces a digit in when the random source gives only letters", () => {
    const code = generateAdCode((max) => (max === 36 ? 10 : 3)); // always 'a', then slot 3 gets digit 3
    expect(code).toBe("aaa3a");
  });

  it("tells a real code from other text", () => {
    expect(isAdCode("k7q2z")).toBe(true);
    expect(isAdCode("abcde")).toBe(false); // no digit
    expect(isAdCode("K7Q2Z")).toBe(false); // upper case
    expect(isAdCode("k7q2")).toBe(false);
    expect(isAdCode("k7q2zz")).toBe(false);
  });
});

describe("H16.2 address text", () => {
  it("builds /category/city/title-code/", () => {
    expect(adAddress({ categorySlug: "dating", citySlug: "surat", title: "Coffee and Long Walks", code: "k7q2z" })).toBe(
      "/dating/surat/coffee-and-long-walks-k7q2z/",
    );
  });

  it("cuts a long title to about 60 characters and never ends the title part with a dash", () => {
    const path = adAddress({ categorySlug: "dating", citySlug: "surat", title: "word ".repeat(40), code: "k7q2z" });
    const last = path.split("/")[3];
    expect(last.length).toBeLessThanOrEqual(60 + 6);
    expect(last).toMatch(/[a-z0-9]-k7q2z$/);
    expect(last).not.toContain("--");
  });

  it("falls back to 'item' when a title has no usable letters", () => {
    expect(adAddress({ categorySlug: "dating", citySlug: "surat", title: "!!!", code: "k7q2z" })).toBe("/dating/surat/item-k7q2z/");
  });

  it("splits the last part into title slug and code", () => {
    expect(splitAdSegment("coffee-and-long-walks-k7q2z")).toEqual({ titleSlug: "coffee-and-long-walks", code: "k7q2z" });
    expect(splitAdSegment("item-k7q2z")).toEqual({ titleSlug: "item", code: "k7q2z" });
    expect(splitAdSegment("k7q2z")).toBeNull(); // a code alone is not an address
    expect(splitAdSegment("coffee-walks-abcde")).toBeNull(); // code without a digit
    expect(splitAdSegment("coffee-walks")).toBeNull();
  });
});

describe("H16.2 route parse and the district clash", () => {
  const districts = new Set(["sector-29", "model-town", "dlf-phase-3", "sec14-ab1cd"]);

  it("serves a known district as the area page, as today", () => {
    expect(parseAdRoute("sector-29", districts)).toEqual({ kind: "area" });
    expect(parseAdRoute("model-town", districts)).toEqual({ kind: "area" });
    expect(parseAdRoute("dlf-phase-3", districts)).toEqual({ kind: "area" });
  });

  it("serves a district first even when its slug looks like an ad address", () => {
    expect(parseAdRoute("sec14-ab1cd", districts)).toEqual({ kind: "area" });
  });

  it("reads -<code> as an ad when it is not a district", () => {
    expect(parseAdRoute("coffee-and-long-walks-k7q2z", districts)).toEqual({
      kind: "ad",
      titleSlug: "coffee-and-long-walks",
      code: "k7q2z",
    });
  });

  it("does not take short numbered words for a code", () => {
    expect(parseAdRoute("sector-30", districts)).toEqual({ kind: "other" });
    expect(parseAdRoute("phase-2", districts)).toEqual({ kind: "other" });
    expect(parseAdRoute("cafe-1", districts)).toEqual({ kind: "other" });
  });

  it("leaves everything else to the sub-category or 404 handling", () => {
    expect(parseAdRoute("nothing-here-at-all", districts)).toEqual({ kind: "other" });
  });
});

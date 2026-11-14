import { describe, expect, it } from "vitest";
import { formatIndianCount } from "@/components/ad/counts-format";
import { isBot } from "@/server/analytics/bots";
import { parseCountSlugs } from "@/server/analytics/input";
import { shownFrom, shownValue } from "@/server/analytics/shown";
import { visitorCookieHeader, visitorKeyFor } from "@/server/analytics/visitor";

describe("H6.17 number format (Indian grouping)", () => {
  it("groups in lakhs and crores", () => {
    expect(formatIndianCount(0)).toBe("0");
    expect(formatIndianCount(999)).toBe("999");
    expect(formatIndianCount(1234)).toBe("1,234");
    expect(formatIndianCount(12345)).toBe("12,345");
    expect(formatIndianCount(123456)).toBe("1,23,456");
    expect(formatIndianCount(1234567)).toBe("12,34,567");
    expect(formatIndianCount(12345678)).toBe("1,23,45,678");
  });
});

describe("H6.17 shown value", () => {
  it("adds the real counts after the set moment to the set number", () => {
    expect(shownValue(1000, 8, 5)).toBe(1003);
    expect(shownValue(0, 0, 0)).toBe(0);
    expect(shownValue(0, 12, 0)).toBe(12);
  });

  it("never goes below zero", () => {
    expect(shownValue(0, 0, 5)).toBe(0);
  });

  it("uses zero for a missing counter", () => {
    expect(shownFrom(null)).toEqual({ views: 0, clicks: 0 });
    expect(shownFrom({ realViews: 3, viewsSet: 10, viewsRealAtSet: 1, realClicks: 2 })).toEqual({ views: 12, clicks: 2 });
  });
});

describe("H6.17 bots and visitor keys", () => {
  it("treats crawlers, scripts and missing agents as bots", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36")).toBe(false);
  });

  it("hashes the visitor, and keys a signed-in person by user id", () => {
    const key = visitorKeyFor({ cookieId: "abcdefghijklmnop" });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).toBe(visitorKeyFor({ cookieId: "abcdefghijklmnop" }));
    expect(visitorKeyFor({ userId: "65a1b2c3d4e5f60718293a4b", cookieId: "abcdefghijklmnop" })).not.toBe(key);
    expect(visitorKeyFor({})).toBeNull();
  });

  it("sets the visitor cookie for a year, first party and not readable by scripts", () => {
    const header = visitorCookieHeader("abcdefghijklmnop", false);
    expect(header).toContain("tk_vid=abcdefghijklmnop");
    expect(header).toContain("Max-Age=31536000");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
  });
});

describe("H6.17 count requests", () => {
  it("keeps only valid, unique slugs and at most 60 of them", () => {
    expect(parseCountSlugs(null)).toEqual([]);
    expect(parseCountSlugs("a-1,<script>,a-1,b-2")).toEqual(["a-1", "b-2"]);
    const many = Array.from({ length: 80 }, (_, index) => `ad-${index}`).join(",");
    expect(parseCountSlugs(many)).toHaveLength(60);
  });
});

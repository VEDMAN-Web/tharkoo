import { describe, expect, it } from "vitest";
import { allowRequest, clientKey, limitBucket } from "@/lib/rate-limit";

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

describe("clientKey", () => {
  it("uses the last X-Forwarded-For entry, the one our own proxy appends", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "9.9.9.9, 2.2.2.2" }))).toBe("2.2.2.2");
  });

  it("ignores empty entries when picking the last one", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, " }))).toBe("2.2.2.2");
  });

  it("falls back to x-real-ip, then to local", () => {
    expect(clientKey(new Headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientKey(new Headers())).toBe("local");
  });
});

describe("limitBucket", () => {
  it("puts pages, search, api and non-GET requests in the right bucket", () => {
    expect(limitBucket("/", "GET", BROWSER)).toEqual({ bucket: "page", envName: "SITE_RATE_MAX", fallback: 240 });
    expect(limitBucket("/property/surat/", "GET", BROWSER)).toEqual({ bucket: "page", envName: "SITE_RATE_MAX", fallback: 240 });
    expect(limitBucket("/search/", "GET", BROWSER)).toEqual({ bucket: "search", envName: "SEARCH_RATE_MAX", fallback: 30 });
    expect(limitBucket("/api/catalog", "GET", BROWSER).bucket).toBe("search");
    expect(limitBucket("/api/listings/", "GET", BROWSER)).toEqual({ bucket: "api", envName: "SITE_RATE_MAX", fallback: 240 });
    expect(limitBucket("/u/login/", "POST", BROWSER)).toEqual({ bucket: "api", envName: "SITE_RATE_MAX", fallback: 240 });
  });

  it("gives known search-engine bots their own, larger bucket for GET and HEAD", () => {
    expect(limitBucket("/property/surat/", "GET", GOOGLEBOT)).toEqual({ bucket: "bot", envName: "BOT_RATE_MAX", fallback: 1200 });
    expect(limitBucket("/property/surat/", "HEAD", GOOGLEBOT).bucket).toBe("bot");
  });

  it("keeps search and api ahead of the bot bucket", () => {
    expect(limitBucket("/search/", "GET", GOOGLEBOT).bucket).toBe("search");
    expect(limitBucket("/api/listings/", "GET", GOOGLEBOT).bucket).toBe("api");
  });
});

describe("allowRequest", () => {
  it("blocks the call after max is reached", () => {
    const key = `test-max-${Math.random()}:page`;
    expect([1, 2, 3].map(() => allowRequest(key, 3, 60_000))).toEqual([true, true, true]);
    expect(allowRequest(key, 3, 60_000)).toBe(false);
  });
});

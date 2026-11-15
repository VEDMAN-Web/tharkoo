import { describe, expect, it } from "vitest";
import { MAX_STATUS_SLUGS, slugsFromQuery } from "@/server/availability/listings";
import { presenceStatus } from "@/server/availability/status";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-11-15T10:00:00Z");

describe("badge slugs from the query (H7.5)", () => {
  it("keeps valid slugs, drops empty and unsafe ones, and removes repeats", () => {
    expect(slugsFromQuery("in00012, jobs-mumbai-1,in00012,,../etc,a b")).toEqual(["in00012", "jobs-mumbai-1"]);
  });

  it("returns nothing for a missing query", () => {
    expect(slugsFromQuery(null)).toEqual([]);
    expect(slugsFromQuery("")).toEqual([]);
  });

  it("caps the number of slugs in one request", () => {
    const many = Array.from({ length: MAX_STATUS_SLUGS + 10 }, (_, i) => `ad${i}`).join(",");
    expect(slugsFromQuery(many)).toHaveLength(MAX_STATUS_SLUGS);
  });
});

describe("badge rule for a card or ad page (H7.5)", () => {
  it("is Online now only with the switch on and recent activity", () => {
    expect(presenceStatus({ available: true, lastActivityAt: new Date(NOW - HOUR) }, NOW, 2)).toBe("online");
  });

  it("is Away with the switch off, even when active", () => {
    expect(presenceStatus({ available: false, lastActivityAt: new Date(NOW) }, NOW, 2)).toBe("away");
  });

  it("is Away after the admin's hours with no activity", () => {
    expect(presenceStatus({ available: true, lastActivityAt: new Date(NOW - 3 * HOUR) }, NOW, 2)).toBe("away");
    expect(presenceStatus({ available: true, lastActivityAt: new Date(NOW - 3 * HOUR) }, NOW, 4)).toBe("online");
  });
});

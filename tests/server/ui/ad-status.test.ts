import { describe, expect, it } from "vitest";
import { ENDING_SOON_MS, ownAdStatus } from "@/lib/ui/ad-status";

const NOW = Date.parse("2026-11-15T12:00:00Z");

describe("vendor panel status label (H6.19)", () => {
  it("shows Live for an active ad with time left", () => {
    const later = new Date(NOW + 20 * 24 * 60 * 60 * 1000).toISOString();
    expect(ownAdStatus("active", later, NOW).label).toBe("Live");
  });

  it("shows Ending soon inside the last day of the run", () => {
    const soon = new Date(NOW + ENDING_SOON_MS - 1000).toISOString();
    expect(ownAdStatus("active", soon, NOW).label).toBe("Ending soon");
  });

  it("shows Live for a new 72 hour ad, which is not ending soon yet", () => {
    const fresh = new Date(NOW + 72 * 60 * 60 * 1000).toISOString();
    expect(ownAdStatus("active", fresh, NOW).label).toBe("Live");
  });

  it("treats an active ad with no end date as Live", () => {
    expect(ownAdStatus("active", null, NOW).label).toBe("Live");
  });

  it("maps pending to In review and expired or archived to Ended", () => {
    expect(ownAdStatus("pending", null, NOW).label).toBe("In review");
    expect(ownAdStatus("expired", null, NOW).label).toBe("Ended");
    expect(ownAdStatus("archived", null, NOW).label).toBe("Ended");
  });

  it("falls back to Draft for an unknown or missing status", () => {
    expect(ownAdStatus("draft", null, NOW).label).toBe("Draft");
    expect(ownAdStatus(undefined, undefined, NOW).label).toBe("Draft");
  });
});

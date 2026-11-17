import { describe, expect, it } from "vitest";
import { overLabel } from "@/app/admin/support/_desk/age";

const NOW = Date.parse("2026-06-15T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

describe("the Over age on the support desk (H7.164)", () => {
  it("says the same hours in the list and in the ticket header, because both use one helper", () => {
    expect(overLabel("waiting_for_support", hoursAgo(39.6), NOW)).toBe("Over 39 h");
    expect(overLabel("waiting_for_support", hoursAgo(4), NOW)).toBe("Over 4 h");
  });

  it("says nothing under 4 hours, and nothing for a ticket that is not waiting for support", () => {
    expect(overLabel("waiting_for_support", hoursAgo(3.9), NOW)).toBeNull();
    expect(overLabel("waiting_for_customer", hoursAgo(50), NOW)).toBeNull();
    expect(overLabel("closed", hoursAgo(50), NOW)).toBeNull();
  });
});

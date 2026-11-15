import { describe, expect, it } from "vitest";
import {
  AWAY_HOURS_MAX,
  AWAY_HOURS_MIN,
  DEFAULT_AWAY_HOURS,
  callsAllowed,
  clampAwayHours,
  presenceStatus,
  statusLabel,
} from "@/server/availability/status";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-11-15T10:00:00Z");

describe("availability status (H7.5)", () => {
  it("is online when the switch is on and the last activity is inside the window", () => {
    const lastActivityAt = new Date(NOW - 1 * HOUR);
    expect(presenceStatus({ available: true, lastActivityAt }, NOW, 2)).toBe("online");
  });

  it("turns Away after the window with no activity (auto-away)", () => {
    const lastActivityAt = new Date(NOW - 2 * HOUR - 1000);
    expect(presenceStatus({ available: true, lastActivityAt }, NOW, 2)).toBe("away");
  });

  it("is online exactly at the window edge", () => {
    const lastActivityAt = new Date(NOW - 2 * HOUR);
    expect(presenceStatus({ available: true, lastActivityAt }, NOW, 2)).toBe("online");
  });

  it("is Away when the switch is off, whatever the activity", () => {
    expect(presenceStatus({ available: false, lastActivityAt: new Date(NOW) }, NOW, 2)).toBe("away");
  });

  it("is Away when there has never been any activity or the time is not a date", () => {
    expect(presenceStatus({ available: true, lastActivityAt: null }, NOW, 2)).toBe("away");
    expect(presenceStatus({ available: true, lastActivityAt: "not a date" }, NOW, 2)).toBe("away");
  });

  it("reads the activity time from an ISO string as well", () => {
    expect(presenceStatus({ available: true, lastActivityAt: new Date(NOW - HOUR).toISOString() }, NOW, 2)).toBe("online");
  });

  it("uses the admin's hours, clamped to the allowed range", () => {
    const lastActivityAt = new Date(NOW - 5 * HOUR);
    expect(presenceStatus({ available: true, lastActivityAt }, NOW, 6)).toBe("online");
    expect(presenceStatus({ available: true, lastActivityAt }, NOW, 2)).toBe("away");
  });

  it("allows calls only while online, and chat is never blocked by the status", () => {
    expect(callsAllowed("online")).toBe(true);
    expect(callsAllowed("away")).toBe(false);
  });

  it("labels the two statuses the way buyers see them", () => {
    expect(statusLabel("online")).toBe("Online now");
    expect(statusLabel("away")).toBe("Away");
  });
});

describe("away hours setting (H7.5)", () => {
  it("defaults to two hours", () => {
    expect(DEFAULT_AWAY_HOURS).toBe(2);
    expect(clampAwayHours(undefined)).toBe(2);
    expect(clampAwayHours("nonsense")).toBe(2);
  });

  it("keeps values inside the range and rounds to whole hours", () => {
    expect(clampAwayHours(0)).toBe(AWAY_HOURS_MIN);
    expect(clampAwayHours(99)).toBe(AWAY_HOURS_MAX);
    expect(clampAwayHours(3.6)).toBe(4);
    expect(clampAwayHours("5")).toBe(5);
  });
});

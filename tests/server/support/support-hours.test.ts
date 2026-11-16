import { describe, expect, it } from "vitest";
import { isSupportOpen, openingLabel, parseSupportHours } from "@/lib/support-hours";

const at = (iso: string) => new Date(iso);

describe("support hours", () => {
  it("reads a range such as 9 am to 9 pm, with or without days in front", () => {
    expect(parseSupportHours("9 am to 9 pm")).toEqual({ openMinutes: 540, closeMinutes: 1260 });
    expect(parseSupportHours("Mon to Sat, 10:30 am - 6 pm IST")).toEqual({ openMinutes: 630, closeMinutes: 1080 });
  });

  it("falls back to 9 am to 9 pm when the text has no range", () => {
    expect(parseSupportHours("")).toEqual({ openMinutes: 540, closeMinutes: 1260 });
    expect(parseSupportHours("Monday through Friday")).toEqual({ openMinutes: 540, closeMinutes: 1260 });
  });

  it("is open only inside the hours in India time", () => {
    const hours = parseSupportHours("9 am to 9 pm");
    expect(isSupportOpen(hours, at("2026-11-16T12:00:00+05:30"))).toBe(true);
    expect(isSupportOpen(hours, at("2026-11-16T03:00:00+05:30"))).toBe(false);
    expect(isSupportOpen(hours, at("2026-11-16T21:00:00+05:30"))).toBe(false);
    expect(isSupportOpen(hours, at("2026-11-16T09:00:00+05:30"))).toBe(true);
    expect(isSupportOpen(hours, at("2026-11-16T04:00:00Z"))).toBe(true);
  });

  it("handles hours that run past midnight", () => {
    const hours = parseSupportHours("8 pm to 2 am");
    expect(isSupportOpen(hours, at("2026-11-16T23:00:00+05:30"))).toBe(true);
    expect(isSupportOpen(hours, at("2026-11-16T01:00:00+05:30"))).toBe(true);
    expect(isSupportOpen(hours, at("2026-11-16T12:00:00+05:30"))).toBe(false);
  });

  it("names the opening time for the offline line", () => {
    expect(openingLabel(parseSupportHours("9 am to 9 pm"))).toBe("9 am");
    expect(openingLabel(parseSupportHours("10:30 am to 6 pm"))).toBe("10:30 am");
    expect(openingLabel(parseSupportHours("12 pm to 8 pm"))).toBe("12 pm");
  });
});

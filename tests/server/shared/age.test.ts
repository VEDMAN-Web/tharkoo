import { describe, expect, it } from "vitest";
import { isAtLeast18, parseDateOnly } from "@/server/shared/age";

const now = new Date("2026-10-28T12:00:00.000Z");

describe("age gate", () => {
  it("parses calendar dates and rejects impossible ones", () => {
    expect(parseDateOnly("2008-10-28")?.toISOString()).toBe("2008-10-28T00:00:00.000Z");
    expect(parseDateOnly("2008-02-31")).toBeNull();
    expect(parseDateOnly("28-10-2008")).toBeNull();
  });

  it("requires a full 18 years", () => {
    expect(isAtLeast18(parseDateOnly("2008-10-28")!, now)).toBe(true);
    expect(isAtLeast18(parseDateOnly("2008-10-27")!, now)).toBe(true);
    expect(isAtLeast18(parseDateOnly("2008-10-29")!, now)).toBe(false);
    expect(isAtLeast18(parseDateOnly("2010-01-01")!, now)).toBe(false);
  });
});

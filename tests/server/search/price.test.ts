import { describe, expect, it } from "vitest";
import { cleanPrice } from "@/server/search/query";

describe("price display", () => {
  it("shows nothing for a missing or unusable price", () => {
    for (const value of [undefined, null, 0, -5, Number.NaN, "100"]) expect(cleanPrice(value)).toBeNull();
    expect(cleanPrice(500)).toBe(500);
  });
});

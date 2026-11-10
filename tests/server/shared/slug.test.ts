import { describe, expect, it } from "vitest";
import { toSlug } from "@/server/shared/slug";

describe("toSlug", () => {
  it("normalizes names and falls back when empty", () => {
    expect(toSlug("Hyderabad Dating")).toBe("hyderabad-dating");
    expect(toSlug("  ")).toBe("item");
  });
});

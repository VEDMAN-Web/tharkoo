import { describe, expect, it } from "vitest";
import { progressPercent } from "@/lib/ui/post-form";

describe("post-ad progress line", () => {
  it("uses 16, 36, 56, 76 and 94 percent for the five steps", () => {
    expect([1, 2, 3, 4, 5].map((step) => progressPercent(step, 5))).toEqual([16, 36, 56, 76, 94]);
  });

  it("fills the line on the Done screens", () => {
    expect(progressPercent(5, 5, true)).toBe(100);
  });

  it("spreads other step counts between 16 and 94 and never leaves the range", () => {
    expect(progressPercent(1, 6)).toBe(16);
    expect(progressPercent(6, 6)).toBe(94);
    expect(progressPercent(0, 6)).toBe(16);
    expect(progressPercent(99, 6)).toBe(94);
  });
});

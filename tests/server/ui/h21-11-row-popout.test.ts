import { describe, expect, it } from "vitest";
import { rowPopBox } from "@/components/new/pop-layout";

describe("H21.11 the list-row pop-out covers its row", () => {
  it("is the row plus 12 px on every side", () => {
    expect(rowPopBox({ left: 100, width: 880, height: 220 }, 1440)).toEqual({ left: 88, width: 904, minHeight: 244 });
  });

  it("stays inside the window at the edges", () => {
    expect(rowPopBox({ left: 0, width: 600, height: 200 }, 1440).left).toBe(8);
    const right = rowPopBox({ left: 800, width: 640, height: 200 }, 1440);
    expect(right.left + right.width).toBeLessThanOrEqual(1440 - 8);
  });

  it("uses the window width less the edges when the row is as wide as the window", () => {
    expect(rowPopBox({ left: 0, width: 1024, height: 200 }, 1024)).toEqual({ left: 8, width: 1008, minHeight: 224 });
  });
});

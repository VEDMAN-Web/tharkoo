import { describe, expect, it } from "vitest";
import { indexAt, LONG_PRESS_MS, moveItem } from "@/components/post/photo-order";

describe("photo order", () => {
  it("moves one photo to a new place and keeps the rest in order", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b"], 1, 9)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("does not change the list it was given", () => {
    const list = ["a", "b", "c"];
    moveItem(list, 0, 2);
    expect(list).toEqual(["a", "b", "c"]);
  });

  it("finds the box under the pointer, or the nearest one", () => {
    const boxes = [
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 110, top: 0, right: 210, bottom: 100 },
    ];
    expect(indexAt(boxes, 150, 50)).toBe(1);
    expect(indexAt(boxes, 105, 50)).toBe(0);
    expect(indexAt(boxes, 400, 50)).toBe(1);
    expect(indexAt([], 1, 1)).toBe(-1);
  });

  it("holds a touch for a quarter of a second before the photo lifts", () => {
    expect(LONG_PRESS_MS).toBe(250);
  });
});

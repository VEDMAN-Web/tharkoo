import { describe, expect, test } from "vitest";
import { safePhoto } from "@/lib/media";

describe("safePhoto", () => {
  test("accepts local brand paths and cloudinary", () => {
    expect(safePhoto("/placeholders/x.jpg")).toBe("/placeholders/x.jpg");
    expect(safePhoto("/brand/logo-mark.svg")).toBe("/brand/logo-mark.svg");
    expect(safePhoto("https://res.cloudinary.com/demo/image/upload/a.jpg")).toBe(
      "https://res.cloudinary.com/demo/image/upload/a.jpg",
    );
  });

  test("rejects other urls", () => {
    expect(safePhoto("javascript:alert(1)")).toBeNull();
    expect(safePhoto("http://evil.example/x.jpg")).toBeNull();
    expect(safePhoto("data:image/svg+xml,hi")).toBeNull();
    expect(safePhoto("")).toBeNull();
  });
});

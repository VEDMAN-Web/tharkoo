import { describe, expect, it } from "vitest";
import { adPhotoLimit } from "@/server/listings/admin-create";
import { AD_MEDIA_LIMIT_MESSAGE, AD_MEDIA_MAX, importPhotoLimit, photoLimit } from "@/server/media/config";

/** H6.18: one limit for every ad, photos and videos together. The category maximum is an upper bound, never above 10. */
describe("one ad media limit (H6.18)", () => {
  it("is 10 photos and videos in total, whatever the plan", () => {
    expect(AD_MEDIA_MAX).toBe(10);
    expect(photoLimit(false)).toBe(10);
    expect(photoLimit(true)).toBe(10);
    expect(AD_MEDIA_LIMIT_MESSAGE).toBe("An ad can have up to 10 photos and videos in total");
  });

  it("a partner import row takes the category maximum as an upper bound, capped at 10", () => {
    expect(importPhotoLimit(null)).toBe(10);
    expect(importPhotoLimit(undefined)).toBe(10);
    expect(importPhotoLimit(4)).toBe(4);
    expect(importPhotoLimit(25)).toBe(10);
    expect(importPhotoLimit(0)).toBe(10);
  });

  it("an admin-created ad uses the same rule as the import", () => {
    expect(adPhotoLimit(null)).toBe(10);
    expect(adPhotoLimit(3)).toBe(3);
    expect(adPhotoLimit(40)).toBe(10);
  });
});

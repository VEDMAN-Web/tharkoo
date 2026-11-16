import { describe, expect, it } from "vitest";
import { mediaSignBodySchema } from "@/server/shared/schemas/listings";

const MB = 1024 * 1024;

describe("media sign request (H7.100 c): videos can be signed", () => {
  it("accepts a 100 MB mp4, webm and mov video", () => {
    for (const contentType of ["video/mp4", "video/webm", "video/quicktime"]) {
      expect(mediaSignBodySchema.safeParse({ contentType, byteSize: 100 * MB, kind: "video" }).success).toBe(true);
    }
  });

  it("refuses a video over 100 MB and a photo over 8 MB", () => {
    expect(mediaSignBodySchema.safeParse({ contentType: "video/mp4", byteSize: 100 * MB + 1, kind: "video" }).success).toBe(false);
    expect(mediaSignBodySchema.safeParse({ contentType: "image/jpeg", byteSize: 8 * MB + 1, kind: "image" }).success).toBe(false);
    expect(mediaSignBodySchema.safeParse({ contentType: "image/jpeg", byteSize: 8 * MB, kind: "image" }).success).toBe(true);
  });

  it("does not let a photo be signed as a video or a video as a photo", () => {
    expect(mediaSignBodySchema.safeParse({ contentType: "image/png", byteSize: 1000, kind: "video" }).success).toBe(false);
    expect(mediaSignBodySchema.safeParse({ contentType: "video/mp4", byteSize: 1000, kind: "image" }).success).toBe(false);
    expect(mediaSignBodySchema.safeParse({ contentType: "video/mp4", byteSize: 1000, kind: "id_document" }).success).toBe(false);
  });
});

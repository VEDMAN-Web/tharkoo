import { describe, expect, it } from "vitest";
import { fileProblem, megabytes, moveItem, UPLOAD_RULES, videoProblem } from "@/components/upload/rules";

const MB = 1024 * 1024;

describe("upload rules (H7.8)", () => {
  it("names the size in plain words when a photo is too big", () => {
    const message = fileProblem({ name: "big.jpg", type: "image/jpeg", size: 12 * MB }, UPLOAD_RULES.adPhotos);
    expect(message).toBe("This photo is 12 MB. The limit is 8 MB.");
  });

  it("refuses a file of the wrong type and keeps the other files usable", () => {
    expect(fileProblem({ name: "note.pdf", type: "application/pdf", size: 1000 }, UPLOAD_RULES.adPhotos)).toContain("not JPG, PNG or WEBP");
    expect(fileProblem({ name: "ok.webp", type: "image/webp", size: 1000 }, UPLOAD_RULES.adPhotos)).toBeNull();
  });

  it("accepts PNG only for a logo", () => {
    expect(fileProblem({ name: "logo.jpg", type: "image/jpeg", size: 1000 }, UPLOAD_RULES.logo)).not.toBeNull();
    expect(fileProblem({ name: "logo.png", type: "image/png", size: 1000 }, UPLOAD_RULES.logo)).toBeNull();
  });

  it("refuses an empty file", () => {
    expect(fileProblem({ name: "empty.png", type: "image/png", size: 0 }, UPLOAD_RULES.logo)).toBe("This image is empty (empty.png).");
  });

  it("checks video length against the limit and reports an unreadable clip", () => {
    expect(videoProblem(12, UPLOAD_RULES.adVideos)).toBeNull();
    expect(videoProblem(41.4, UPLOAD_RULES.adVideos)).toBe("This video is 41 seconds. The limit is 30 seconds.");
    expect(videoProblem(Number.NaN, UPLOAD_RULES.adVideos)).toContain("could not be read");
  });

  it("gives every box an info line and popover rows", () => {
    for (const rule of Object.values(UPLOAD_RULES)) {
      expect(rule.line.length).toBeGreaterThan(0);
      expect(rule.details.length).toBeGreaterThan(0);
    }
  });

  it("formats sizes with one decimal only when needed", () => {
    expect(megabytes(8 * MB)).toBe("8 MB");
    expect(megabytes(1.5 * MB)).toBe("1.5 MB");
  });

  it("moves an item and clamps at the ends", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, -2)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 5)).toEqual(["a", "c", "b"]);
  });
});

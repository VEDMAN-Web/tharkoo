import { describe, expect, it } from "vitest";
import { parseCsv } from "@/server/listings/csv";
import { DEFAULT_CATEGORY_IMPORT_MAX, IMPORT_CHUNK_ROWS, MAX_IMPORT_ROWS, assertRowCap, parsePhotoCell, photoLimitForImport } from "@/server/import/rules";
import { IMPORT_TEMPLATE_HEADERS, importTemplateCsv } from "@/server/import/template";
import { photoLimit } from "@/server/media/config";

describe("photos column", () => {
  it("reads file names separated by | in order, the first is the cover", () => {
    expect(parsePhotoCell("flat1-a.jpg|flat1-b.jpg")).toEqual([
      { kind: "file", value: "flat1-a.jpg" },
      { kind: "file", value: "flat1-b.jpg" },
    ]);
  });

  it("keeps an upload URL next to file names and ignores empty entries", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/tharkoo/listings/kids.jpg";
    expect(parsePhotoCell(`a.jpg || ${url} |`)).toEqual([
      { kind: "file", value: "a.jpg" },
      { kind: "url", value: url },
    ]);
  });

  it("treats a path on this site as an upload, and keeps spaces inside a file name", () => {
    expect(parsePhotoCell("/uploads/own-photo.jpg|red sofa 1.jpg")).toEqual([
      { kind: "url", value: "/uploads/own-photo.jpg" },
      { kind: "file", value: "red sofa 1.jpg" },
    ]);
  });

  it("returns nothing for an empty cell", () => {
    expect(parsePhotoCell("")).toEqual([]);
    expect(parsePhotoCell(" | ")).toEqual([]);
  });
});

describe("photo limit per import", () => {
  it("gives a superadmin the category maximum", () => {
    expect(photoLimitForImport(true, 6)).toBe(6);
  });

  it("uses the default maximum for a superadmin when the category has none", () => {
    expect(photoLimitForImport(true, null)).toBe(DEFAULT_CATEGORY_IMPORT_MAX);
    expect(photoLimitForImport(true, undefined)).toBe(DEFAULT_CATEGORY_IMPORT_MAX);
    expect(photoLimitForImport(true, 0)).toBe(DEFAULT_CATEGORY_IMPORT_MAX);
  });

  it("keeps the free plan limit for an admin, whatever the category says", () => {
    expect(photoLimitForImport(false, 6)).toBe(photoLimit(false));
    expect(photoLimitForImport(false, null)).toBe(photoLimit(false));
  });
});

describe("row cap", () => {
  it("allows 500 rows and refuses 501 with the limit in the message", () => {
    expect(MAX_IMPORT_ROWS).toBe(500);
    expect(assertRowCap(500)).toBeNull();
    expect(assertRowCap(501)).toMatch(/500/);
  });

  it("imports in blocks that fit well inside one file", () => {
    expect(IMPORT_CHUNK_ROWS).toBeGreaterThan(0);
    expect(IMPORT_CHUNK_ROWS).toBeLessThanOrEqual(MAX_IMPORT_ROWS);
  });
});

describe("template", () => {
  it("has every base column and example rows that read back as CSV", () => {
    const table = parseCsv(importTemplateCsv());
    expect(table[0]).toEqual([...IMPORT_TEMPLATE_HEADERS]);
    expect(table).toHaveLength(3);
    expect(table.every((row) => row.length === IMPORT_TEMPLATE_HEADERS.length)).toBe(true);
    expect(table[1][IMPORT_TEMPLATE_HEADERS.indexOf("photos")]).toBe("hero-cycle_01.jpg|hero-cycle_02.jpg");
  });
});

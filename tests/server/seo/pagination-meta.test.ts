import { describe, expect, it } from "vitest";
import { withPagination } from "@/lib/seo/pagination";

describe("withPagination", () => {
  it("links next on the first page", () => {
    const meta = withPagination({}, "/dating/", 1, 3);
    expect(String(meta.pagination?.next)).toMatch(/\/dating\/\?page=2$/);
    expect(meta.pagination?.previous).toBeUndefined();
  });

  it("links previous to the clean page from page 2, and both in the middle", () => {
    const second = withPagination({}, "/dating/", 2, 3);
    expect(String(second.pagination?.previous)).toMatch(/\/dating\/$/);
    expect(String(second.pagination?.next)).toMatch(/\/dating\/\?page=3$/);
  });

  it("links only previous on the last page and nothing for a single page", () => {
    const last = withPagination({}, "/dating/", 3, 3);
    expect(last.pagination?.next).toBeUndefined();
    expect(String(last.pagination?.previous)).toMatch(/\/dating\/\?page=2$/);
    expect(withPagination({ title: "x" }, "/dating/", 1, 1)).toEqual({ title: "x" });
  });
});

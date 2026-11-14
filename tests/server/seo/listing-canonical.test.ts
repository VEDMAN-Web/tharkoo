import { describe, expect, it } from "vitest";
import { listingCanonicalSuffix, listingRobots } from "@/server/search/filter-seo";
import { SITEMAP_SHARDS } from "@/lib/seo/sitemaps";

describe("filter URLs and their canonical", () => {
  it("keeps pagination on unfiltered pages only", () => {
    expect(listingCanonicalSuffix({}, 1)).toBe("");
    expect(listingCanonicalSuffix({}, 2)).toBe("?page=2");
    expect(listingCanonicalSuffix({ page: "2" }, 2)).toBe("?page=2");
  });

  it("points a filtered page at the clean page, with no query string", () => {
    expect(listingCanonicalSuffix({ q: "gym" }, 1)).toBe("");
    expect(listingCanonicalSuffix({ photos: "1", page: "3" }, 3)).toBe("");
    expect(listingCanonicalSuffix({ "f.hair": ["Blonde"] }, 2)).toBe("");
  });

  it("is noindex, follow for any filter and index, follow for pagination and tracking only", () => {
    expect(listingRobots({ "f.hair": ["Blonde"] })).toEqual({ index: false, follow: true });
    expect(listingRobots({ page: "2" })).toEqual({ index: true, follow: true });
    expect(listingRobots({ utm_source: "mail", gclid: "x" })).toEqual({ index: true, follow: true });
  });
});

describe("sitemap shards", () => {
  it("lists only the three indexable listing types, plus ads and content", () => {
    expect([...SITEMAP_SHARDS]).toEqual(["categories", "cities", "districts", "ads", "content"]);
  });
});

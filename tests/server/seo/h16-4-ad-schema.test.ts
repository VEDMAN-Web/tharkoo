import { describe, expect, it } from "vitest";
import { adJsonLdNodes, listingJsonLd, type ListingSchemaInput } from "@/lib/seo/schema";

/** H16.4 (e): an ad page's structured data is written for REAL ads only, and never says anything commercial about a person. */

const crumbs = [
  { name: "Tharkoo India", path: "/" },
  { name: "Category", path: "/c/" },
];
const base: ListingSchemaInput = { category: "buy-and-sell", name: "Steel almirah", description: "A steel almirah in good shape.", url: "https://tharkoo.example/ad/x/", city: "Pune" };
const typesOf = (input: Partial<ListingSchemaInput> & { sample?: boolean; people?: boolean }) => {
  const { sample = false, ...listing } = input;
  return adJsonLdNodes({ crumbs, title: "t", path: "/ad/x/", sample, listing: { ...base, ...listing } }).map((node) => node["@type"]);
};

describe("goods", () => {
  it("a real goods ad is a Product with no Offer (an ad has no price)", () => {
    const node = listingJsonLd(base) as { "@type": string; offers?: { "@type": string; price: string; priceCurrency: string } };
    expect(node["@type"]).toBe("Product");
    expect(node.offers).toBeUndefined();
  });

  it("a property ad is a RealEstateListing with its date and no Offer, not a Product", () => {
    const node = listingJsonLd({ ...base, category: "property", name: "2 room flat", datePosted: "2026-11-01T00:00:00.000Z" }) as Record<string, unknown>;
    expect(node["@type"]).toBe("RealEstateListing");
    expect(node.datePosted).toBe("2026-11-01T00:00:00.000Z");
    expect(node.offers).toBeUndefined();
  });
});

describe("services and jobs", () => {
  it("a services ad is a Service", () => {
    expect(listingJsonLd({ ...base, category: "education", name: "Maths tuition" })?.["@type"]).toBe("Service");
  });

  const job: Partial<ListingSchemaInput> = { category: "jobs", name: "Shop assistant", datePosted: "2026-11-01T00:00:00.000Z", validThrough: "2026-12-01T00:00:00.000Z", hiringOrganization: "Asha Stores", jobLocation: "Pune" };

  it("a job is a JobPosting only when the poster is verified and every required field is there", () => {
    expect(listingJsonLd({ ...base, ...job, verifiedPoster: true })?.["@type"]).toBe("JobPosting");
    expect(listingJsonLd({ ...base, ...job, verifiedPoster: false })).toBeNull();
    expect(listingJsonLd({ ...base, ...job })).toBeNull();
    expect(listingJsonLd({ ...base, ...job, verifiedPoster: true, hiringOrganization: undefined })).toBeNull();
  });
});

describe("nothing commercial on people or sample ads", () => {
  it("a people ad (dating, friends, meet people, spa and the like) gets only the breadcrumb, whatever its category or mapping says", () => {
    for (const category of ["dating", "transgender", "personal-ads", "spa", "buy-and-sell", "property", "jobs"]) {
      expect(typesOf({ category, people: true, verifiedPoster: true, mapping: "Product" }), category).toEqual(["BreadcrumbList"]);
    }
  });

  it("a sample ad gets only the breadcrumb", () => {
    expect(typesOf({ sample: true })).toEqual(["BreadcrumbList"]);
    expect(typesOf({ sample: true, category: "property" })).toEqual(["BreadcrumbList"]);
  });

  it("a real goods ad that is not a people ad keeps its Product", () => {
    expect(typesOf({ people: false })).toEqual(["BreadcrumbList", "Product"]);
  });
});

import { describe, expect, it } from "vitest";
import { adJsonLdNodes, blogPostingFromPost, isoDate, itemListNode, organizationFromSettings, webPageNode } from "@/lib/seo/schema";

/** H17.5: structured data says only what the page shows, with real dates and counts. */

describe("isoDate", () => {
  it("keeps a date that is already ISO 8601 and turns a written date into one", () => {
    expect(isoDate("2026-05-10")).toBe("2026-05-10");
    expect(isoDate("2026-05-10T08:30:00.000Z")).toBe("2026-05-10T08:30:00.000Z");
    expect(isoDate("March 3, 2026")).toBe("2026-03-03");
  });

  it("keeps only the month when a post gives only a month, never inventing a day", () => {
    expect(isoDate("November 2026")).toBe("2026-11");
    expect(isoDate("Nov 2026")).toBe("2026-11");
  });

  it("gives nothing for a date it cannot read, never today's date", () => {
    expect(isoDate("")).toBeUndefined();
    expect(isoDate("soon")).toBeUndefined();
    expect(isoDate(undefined)).toBeUndefined();
  });

  it("writes a Date as a full ISO 8601 time", () => {
    expect(isoDate(new Date("2026-06-01T10:00:00Z"))).toBe("2026-06-01T10:00:00.000Z");
  });
});

describe("BlogPosting", () => {
  const url = "https://tharkoo.example/blog/stay-safe/";
  const logo = "https://tharkoo.example/brand/logo-mark-512.png";

  it("has ISO dates, the cover image and the author", () => {
    const node = blogPostingFromPost({ title: "Stay safe", date: "March 3, 2026", updatedAt: new Date("2026-04-02T09:00:00Z"), author: "Asha Rao", cover: "https://cdn.example/c.jpg" }, url, logo);
    expect(node["@type"]).toBe("BlogPosting");
    expect(node.datePublished).toBe("2026-03-03");
    expect(node.dateModified).toBe("2026-04-02T09:00:00.000Z");
    expect(node.image).toEqual(["https://cdn.example/c.jpg"]);
    expect(node.author).toEqual({ "@type": "Person", name: "Asha Rao" });
  });

  it("uses the default image when the post has no cover, and the site as author when none is named", () => {
    const node = blogPostingFromPost({ title: "Stay safe", date: "2026-01-05" }, url, logo);
    expect(node.image).toEqual([logo]);
    expect(node.author).toEqual({ "@type": "Organization", name: "Tharkoo" });
    expect(node.dateModified).toBe("2026-01-05");
  });

  it("leaves a date out when the post has none that can be read", () => {
    const node = blogPostingFromPost({ title: "Stay safe", date: "sometime" }, url, logo) as Record<string, unknown>;
    expect("datePublished" in node).toBe(false);
    expect("dateModified" in node).toBe(false);
  });
});

describe("ItemList", () => {
  it("counts the items in the list, not the total behind the pages", () => {
    const list = itemListNode({
      url: "https://tharkoo.example/property/pune/",
      items: [
        { url: "https://tharkoo.example/ad/a/", name: "A", position: 1 },
        { url: "https://tharkoo.example/ad/b/", name: "B", position: 2 },
      ],
    });
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement).toHaveLength(2);
  });
});

describe("WebPage", () => {
  it("is named by the page title", () => {
    const node = webPageNode({ name: "Property in Pune", path: "/property/pune/", siteName: "Tharkoo" });
    expect(node["@type"]).toBe("WebPage");
    expect(node.name).toBe("Property in Pune");
    expect(node.name).not.toContain("/property/");
  });
});

describe("Organization", () => {
  it("takes sameAs only from the admin list, empty by default", () => {
    expect((organizationFromSettings("Tharkoo", { logo: "https://x.test/l.png" }, null) as Record<string, unknown>).sameAs).toBeUndefined();
    expect(organizationFromSettings("Tharkoo", {}, { sameAs: ["https://x.example/a"] })).toMatchObject({ sameAs: ["https://x.example/a"] });
  });

  it("gets a contactPoint from the settings, or from the support contact the site shows", () => {
    expect(organizationFromSettings("Tharkoo", {}, { email: "help@x.test", phone: "+91 11 5550 0000" })).toMatchObject({ contactPoint: { "@type": "ContactPoint", email: "help@x.test", telephone: "+91 11 5550 0000" } });
    expect(organizationFromSettings("Tharkoo", {}, null, { email: "support@x.test" })).toMatchObject({ contactPoint: { email: "support@x.test" } });
    expect(organizationFromSettings("Tharkoo", {}, { email: "help@x.test" }, { email: "support@x.test" })).toMatchObject({ contactPoint: { email: "help@x.test" } });
  });
});

describe("ad page structured data", () => {
  const crumbs = [
    { name: "Tharkoo India", path: "/" },
    { name: "Property", path: "/property/" },
    { name: "Pune Property", path: "/property/pune/" },
  ];
  const listing = { category: "property", name: "Flat in Pune", description: "Two rooms.", url: "https://tharkoo.example/ad/demo-1/", price: 5000000 };

  it("ends the breadcrumb with the ad", () => {
    const nodes = adJsonLdNodes({ crumbs, title: "Flat in Pune", path: "/ad/demo-1/", sample: false, listing });
    const list = nodes[0] as { itemListElement: { position: number; name: string; item: string }[] };
    expect(list.itemListElement).toHaveLength(4);
    expect(list.itemListElement[3]).toMatchObject({ position: 4, name: "Flat in Pune" });
    expect(list.itemListElement[3]?.item).toContain("/ad/demo-1/");
  });

  it("describes a real ad as a product with its price (a property ad is a RealEstateListing since H16.4)", () => {
    const nodes = adJsonLdNodes({ crumbs, title: "Flat in Pune", path: "/ad/demo-1/", sample: false, listing: { ...listing, category: "buy-and-sell" } });
    expect(nodes.map((node) => node["@type"])).toEqual(["BreadcrumbList", "Product"]);
    const property = adJsonLdNodes({ crumbs, title: "Flat in Pune", path: "/ad/demo-1/", sample: false, listing });
    expect(property.map((node) => node["@type"])).toEqual(["BreadcrumbList", "RealEstateListing"]);
  });

  it("writes no Offer, Product, JobPosting or rating for a sample ad", () => {
    for (const category of ["property", "jobs", "wellness"]) {
      const nodes = adJsonLdNodes({ crumbs, title: "Sample", path: "/ad/demo-1/", sample: true, listing: { ...listing, category, hiringOrganization: "Acme", datePosted: "2026-01-01T00:00:00Z", validThrough: "2026-02-01T00:00:00Z", jobLocation: "Pune" } });
      expect(nodes.map((node) => node["@type"]), category).toEqual(["BreadcrumbList"]);
      const text = JSON.stringify(nodes);
      for (const word of ["Offer", "Product", "JobPosting", "aggregateRating", "Review", "ratingValue"]) expect(text, `${category} ${word}`).not.toContain(word);
    }
  });
});

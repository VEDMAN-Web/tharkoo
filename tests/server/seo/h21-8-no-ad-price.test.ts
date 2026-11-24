import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { MiniAdCard } from "@/components/ui/MiniAdCard";
import { listingRowData } from "@/components/new/listing-row-data";
import { fallbackLanding } from "@/lib/seo/landing";
import { listingJsonLd, missingSchemaFields } from "@/lib/seo/schema";
import { readPaths } from "@/lib/urls";

const base = { name: "Flat for rent", description: "Two rooms near the market", url: "https://example.test/a/", city: "Surat", price: 12500, datePosted: "2026-11-01T00:00:00.000Z" };

describe("H21.8 the ad price is not in the structured data", () => {
  it("writes no Offer and no price for a property, a service or a goods ad that has a price", () => {
    for (const category of ["property", "services", "bikes", "electronics"]) {
      const node = listingJsonLd({ ...base, category });
      const text = JSON.stringify(node);
      expect(text, category).not.toMatch(/"Offer"|"price"|priceCurrency|12500/);
    }
  });

  it("still writes the node itself (a Product with the SEO mapping needs no price now)", () => {
    const node = listingJsonLd({ ...base, category: "bikes", mapping: "Product" }) as { "@type": string } | null;
    expect(node?.["@type"]).toBe("Product");
    expect(missingSchemaFields("Product", { category: "bikes", name: "x", description: "y", url: "u" })).toEqual([]);
  });
});

describe("H21.8 no ad price in the page words", () => {
  it("the landing text says nothing about listed prices", () => {
    const copy = fallbackLanding({ category: "Property", city: "Surat", count: 5, site: "Tharkoo" } as never);
    expect(JSON.stringify(copy)).not.toMatch(/prices?\b/i);
  });
});

describe("H21.8 cards carry no ad price", () => {
  it("the row card data has no price fields, whatever the ad has", () => {
    const row = listingRowData({ slug: "x", title: "T", citySlug: "surat", categorySlug: "property", price: 12500 } as never, new Map(), readPaths(undefined), "Ad");
    expect(Object.keys(row)).not.toContain("price");
    expect(Object.keys(row)).not.toContain("showPrice");
  });

  it("the small ad card shows no price", () => {
    const html = renderToStaticMarkup(createElement(MiniAdCard, { href: "/x/", title: "Flat", photo: null, price: 5000 } as never));
    expect(html).not.toContain("5,000");
    expect(html).not.toContain("tk-mini-ad-price");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdCard } from "@/components/ui/AdCard";
import type { ListingDoc } from "@/lib/models";

const base: ListingDoc = { slug: "a-1", publicId: "a1", title: "Sample ad", categorySlug: "jobs", citySlug: "pune", photos: [] };
const render = (ad: ListingDoc) => renderToStaticMarkup(createElement(AdCard, { ad }));

describe("price on the result card", () => {
  it("shows the formatted price when the ad has one", () => {
    const html = render({ ...base, price: 12500 });
    expect(html).toContain('data-tk="card-price"');
    expect(html).toContain("12,500");
  });

  it("shows nothing when the price is null or missing", () => {
    expect(render({ ...base, price: null })).not.toContain("card-price");
    expect(render(base)).not.toContain("card-price");
  });
});

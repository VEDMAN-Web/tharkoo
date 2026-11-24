import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdCard } from "@/components/ui/AdCard";
import type { ListingDoc } from "@/lib/models";

const base: ListingDoc = { slug: "a-1", publicId: "a1", title: "Sample ad", categorySlug: "jobs", citySlug: "pune", photos: [] };
const render = (ad: ListingDoc) => renderToStaticMarkup(createElement(AdCard, { ad }));

describe("no price on the result card (H21.8)", () => {
  it("shows no price even when the ad has one stored", () => {
    const html = render({ ...base, price: 12500 });
    expect(html).not.toContain("card-price");
    expect(html).not.toContain("12,500");
  });

  it("shows nothing when the price is null or missing", () => {
    expect(render({ ...base, price: null })).not.toContain("card-price");
    expect(render(base)).not.toContain("card-price");
  });
});

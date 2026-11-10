import { describe, expect, it } from "vitest";
import { fallbackLanding, mergeLanding } from "@/lib/seo/landing";
import { breadcrumbList, faqPage, itemListNode, listingJsonLd, organizationNode, publicPath, websiteNode } from "@/lib/seo/schema";
import { sitemapIndexXml } from "@/lib/seo/sitemaps";

describe("structured data", () => {
  it("builds Product, Offer, breadcrumbs, website search, and FAQ shapes", () => {
    const personal = listingJsonLd({
      category: "dating",
      name: "Coffee in Gurgaon",
      description: "A dating notice.",
      url: "https://tharkoo.example/ad/demo/",
    });
    expect(personal).toBeNull();
    const product = listingJsonLd({
      category: "buy-and-sell",
      name: "Desk",
      description: "For sale",
      url: "https://tharkoo.example/ad/desk/",
      price: 1500,
    });
    const offer = product as { "@type": string; offers?: { price?: string; priceCurrency?: string; seller?: unknown } };
    expect(offer["@type"]).toBe("Product");
    expect(offer.offers?.price).toBe("1500");
    expect(offer.offers?.priceCurrency).toBe("INR");
    expect(offer.offers?.seller).toBeUndefined();
    const free = listingJsonLd({
      category: "vehicles",
      name: "Cycle",
      description: "Listed without a price",
      url: "https://tharkoo.example/ad/cycle/",
      price: 0,
    });
    expect((free as { offers?: unknown } | null)?.offers).toBeUndefined();

    const crumbs = breadcrumbList([
      { name: "India", path: "/" },
      { name: "Dating", path: "/dating/" },
    ]);
    expect(crumbs["@type"]).toBe("BreadcrumbList");
    expect(crumbs.itemListElement[0]?.position).toBe(1);

    const site = websiteNode("Tharkoo");
    expect(site["@type"]).toBe("WebSite");
    expect(site.potentialAction["@type"]).toBe("SearchAction");
    expect(site.potentialAction["query-input"]).toBe("required name=search_term_string");
    expect(organizationNode("Tharkoo")["@type"]).toBe("Organization");

    const faq = faqPage([{ q: "Where?", a: "Gurgaon." }]);
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity[0]?.acceptedAnswer["@type"]).toBe("Answer");

    const list = itemListNode({
      url: "https://tharkoo.example/dating/gurgaon/",
      total: 1,
      items: [{ url: "https://tharkoo.example/ad/demo/", name: "Coffee", position: 1 }],
    });
    expect(list["@type"]).toBe("ItemList");
    expect(list.itemListElement[0]?.["@type"]).toBe("ListItem");
  });

  it("strips tracking params and varies landing copy by place", () => {
    expect(publicPath("/dating/gurgaon/?utm_source=ad&page=2&gclid=1&fbclid=z")).toBe("/dating/gurgaon/?page=2");
    const gurgaon = fallbackLanding({ category: "Dating", city: "Gurgaon", count: 12 });
    const delhi = fallbackLanding({ category: "Dating", city: "Delhi", count: 12 });
    expect(gurgaon.h1).toBe("Dating in Gurgaon");
    expect(gurgaon.intro).not.toBe(delhi.intro);
    const edited = mergeLanding(gurgaon, { intro: "Custom intro for Gurgaon.", faqs: [{ q: "Q", a: "A" }] });
    expect(edited.intro).toBe("Custom intro for Gurgaon.");
    expect(edited.faqs).toEqual([{ q: "Q", a: "A" }]);
  });

  it("lists every sitemap shard from the index", () => {
    const xml = sitemapIndexXml(["categories", "cities", "districts", "tags", "ads", "content"]);
    expect(xml).toContain("<sitemapindex");
    for (const shard of ["categories", "cities", "districts", "tags", "ads", "content"]) {
      expect(xml).toContain(`/sitemap/${shard}.xml`);
    }
  });
});

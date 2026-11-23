import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import mongoose from "mongoose";
import { MoreInCity } from "@/components/new/MoreInCity";
import { ListingPager } from "@/components/new/ListingPager";
import { pagedText } from "@/lib/seo/pagination";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const LABELS = { nav: "Pages", prev: "Previous", prevShort: "Prev", next: "Next", showing: "Showing {from} to {to} of {total}", status: "Page {page} of {pages}", pageLabel: "Page {page}" };

describe("H17.3 page number in titles and headings", () => {
  it("adds (page N) from page 2, before the site name", () => {
    expect(pagedText("Dating in Surat | Tharkoo", 2)).toBe("Dating in Surat (page 2) | Tharkoo");
    expect(pagedText("Dating in Surat", 3)).toBe("Dating in Surat (page 3)");
  });

  it("leaves page 1 and bad page numbers alone", () => {
    expect(pagedText("Dating in Surat | Tharkoo", 1)).toBe("Dating in Surat | Tharkoo");
    expect(pagedText("Dating in Surat", 0)).toBe("Dating in Surat");
    expect(pagedText("Dating in Surat", Number.NaN)).toBe("Dating in Surat");
  });

  it("keeps the site name part when the text has more than one bar", () => {
    expect(pagedText("A | B | Tharkoo", 2)).toBe("A | B (page 2) | Tharkoo");
  });
});

describe("H17.3 numbered page links are real anchors", () => {
  const html = renderToStaticMarkup(createElement(ListingPager, { base: "/dating/surat/", page: 2, pages: 5, total: 70, size: 15, labels: LABELS }));

  it("lists numbers, previous and next as <a href> with ?page=N", () => {
    // (next/link drops the trailing slash only in this test; the real build adds it back from next.config.)
    expect(html).toMatch(/<a [^>]*href="\/dating\/surat\/?"/);
    expect(html).toMatch(/<a [^>]*href="\/dating\/surat\/?\?page=3"/);
    expect(html).toMatch(/<a [^>]*href="\/dating\/surat\/?\?page=5"/);
    expect(html).toMatch(/<a [^>]*rel="prev"[^>]*href="\/dating\/surat\/?"|<a [^>]*href="\/dating\/surat\/?"[^>]*rel="prev"/);
    expect(html).toMatch(/<a [^>]*rel="next"[^>]*href="\/dating\/surat\/?\?page=3"|<a [^>]*href="\/dating\/surat\/?\?page=3"[^>]*rel="next"/);
  });

  it("shows the current page as plain text, not a link", () => {
    expect(html).toMatch(/aria-current="page"[^>]*>2</);
    expect(html).not.toMatch(/href="\/dating\/surat\/?\?page=2"/);
  });
});

describe("H17.3 More ads in {city}", () => {
  it("is a link to the city page with the city name in the text", () => {
    const html = renderToStaticMarkup(createElement(MoreInCity, { href: "/cities/surat/", text: "More ads in Surat" }));
    expect(html).toMatch(/<a href="\/cities\/surat\/?">/);
    expect(html).toContain("More ads in Surat");
    expect(html).toContain('data-tk="more-in-city"');
  });
});

describe("H17.3 search is noindex, follow, also after launch", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    delete process.env.MONGODB_URI;
    await connectMemoryMongo();
  });
  afterAll(async () => {
    await disconnectMemoryMongo();
    delete process.env.SITE_NOINDEX;
  });

  it("answers robots index false and follow true when the site is live", async () => {
    await clearMemoryMongo();
    process.env.SITE_NOINDEX = "false";
    const { generateMetadata } = await import("@/app/search/page");
    const meta = await generateMetadata();
    expect(meta.robots).toMatchObject({ index: false, follow: true });
  });
});

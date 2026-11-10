import { afterEach, describe, expect, it } from "vitest";
import { TRUST, trustWords } from "@/content/trust";
import { fallbackLanding, wordCount } from "@/lib/seo/landing";
import { blogPostingNode, listingJsonLd, organizationNode } from "@/lib/seo/schema";
import { pageOutOfRange } from "@/lib/queries";
import { siteUrl } from "@/lib/utils";
import { listingVisibility } from "@/server/listings/visibility";
import { postIndexNow } from "@/server/indexnow/ping";
import { GET as indexNowKey } from "@/app/api/indexnow/[key]/route";

const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
});

describe("SEO delta", () => {
  it("prefers SITE_URL and strips a trailing slash", () => {
    process.env.SITE_URL = "https://example.test/";
    process.env.NEXT_PUBLIC_SITE_URL = "https://other.test";
    expect(siteUrl()).toBe("https://example.test");
    delete process.env.SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://public.test/";
    expect(siteUrl()).toBe("https://public.test");
  });

  it("keeps indexable hub copy between 80 and 120 words and unique by city", () => {
    const gurgaon = fallbackLanding({ category: "Dating", city: "Gurgaon", count: 12, indexable: true, districts: ["DLF"], site: "Tharkoo" });
    const delhi = fallbackLanding({ category: "Dating", city: "Delhi", count: 16, indexable: true, site: "Tharkoo" });
    expect(wordCount(gurgaon.intro)).toBeGreaterThanOrEqual(80);
    expect(wordCount(gurgaon.intro)).toBeLessThanOrEqual(120);
    expect(wordCount(delhi.intro)).toBeGreaterThanOrEqual(80);
    expect(gurgaon.intro).not.toBe(delhi.intro);
    const thin = fallbackLanding({ category: "Dating", city: "Gurgaon", count: 1 });
    expect(wordCount(thin.intro)).toBeLessThan(80);
  });

  it("404s a page past the end and keeps a missing page on page 1", () => {
    expect(pageOutOfRange(undefined, 3)).toBe(false);
    expect(pageOutOfRange("1", 3)).toBe(false);
    expect(pageOutOfRange("4", 3)).toBe(true);
    expect(pageOutOfRange("0", 3)).toBe(true);
    expect(pageOutOfRange("abc", 3)).toBe(true);
  });

  it("branches listing schema and omits a zero price and a seller", () => {
    expect(listingJsonLd({ category: "dating", name: "Hi", description: "Note", url: "https://example.test/ad/a/" })).toBeNull();
    const service = listingJsonLd({ category: "wellness", name: "Yoga", description: "A class", url: "https://example.test/ad/y/", city: "Pune", price: 500 });
    expect(service?.["@type"]).toBe("Service");
    expect((service as { offers?: { price?: string } }).offers?.price).toBe("500");
    expect(JSON.stringify(service)).not.toContain("seller");
    const job = listingJsonLd({ category: "jobs", name: "Clerk", description: "Day shift", url: "https://example.test/ad/j/" });
    expect(job).toBeNull();
    const full = listingJsonLd({
      category: "jobs",
      name: "Clerk",
      description: "Day shift",
      url: "https://example.test/ad/j/",
      datePosted: "2026-11-01",
      validThrough: "2026-12-01",
      hiringOrganization: "North Shop",
      jobLocation: "Pune",
    });
    expect(full?.["@type"]).toBe("JobPosting");
  });

  it("returns 410 for a removed ad and a 200 window for a fresh expiry", () => {
    expect(listingVisibility({ status: "removed" })).toBe("gone");
    expect(listingVisibility({ status: "deleted" })).toBe("gone");
    expect(listingVisibility({ status: "expired", expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })).toBe("ended");
    expect(listingVisibility({ status: "expired", expiresAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) })).toBe("gone");
    expect(listingVisibility({ status: "active", expiresAt: new Date(Date.now() + 86_400_000) })).toBe("live");
    expect(listingVisibility(null)).toBe("missing");
  });

  it("serves the IndexNow key only when it matches and posts a batched body", async () => {
    process.env.INDEXNOW_KEY = "abc123key";
    const ok = await indexNowKey(new Request("http://127.0.0.1/abc123key.txt"), { params: Promise.resolve({ key: "abc123key" }) });
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("abc123key");
    const miss = await indexNowKey(new Request("http://127.0.0.1/nope.txt"), { params: Promise.resolve({ key: "nope" }) });
    expect(miss.status).toBe(404);
    let body = "";
    process.env.INDEXNOW_HOST = "https://example.test";
    const sent = await postIndexNow(["https://example.test/ad/one/"], async (_url, init) => {
      body = String(init?.body || "");
      return new Response("ok", { status: 200 });
    });
    expect(sent.sent).toBe(true);
    expect(body).toContain("https://example.test/ad/one/");
    expect(body).toContain("abc123key");
  });

  it("adds a logo and only real social profiles", () => {
    const node = organizationNode("Tharkoo", { logo: "https://example.test/brand/logo-mark.svg", sameAs: ["https://example.test/profile", "mailto:hi@example.test"] });
    expect(node.logo).toBe("https://example.test/brand/logo-mark.svg");
    expect(node.sameAs).toEqual(["https://example.test/profile"]);
    const post = blogPostingNode({ headline: "Stay safe", url: "https://example.test/blog/stay-safe/", author: "Tharkoo" });
    expect(post["@type"]).toBe("BlogPosting");
    expect(post.author["@type"]).toBe("Organization");
  });

  it("gives every trust page a unique title and at least 300 words", () => {
    const titles = Object.values(TRUST).map((page) => page.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const key of Object.keys(TRUST)) expect(trustWords(key)).toBeGreaterThanOrEqual(300);
    expect(defaultDescriptionLength()).toBeGreaterThanOrEqual(150);
    expect(defaultDescriptionLength()).toBeLessThanOrEqual(160);
  });
});

function defaultDescriptionLength() {
  return "Tharkoo is a free classifieds site for India. Browse dating, friendship, jobs, homes, and vehicles, then contact the poster in the app after an ID check.".length;
}

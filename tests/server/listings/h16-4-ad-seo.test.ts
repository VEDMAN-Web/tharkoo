import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const queued: string[][] = [];
vi.mock("@/server/indexnow/ping", () => ({ queueIndexNow: (paths: string[]) => void queued.push(paths) }));

import { generateMetadata as adMetadata, default as AdPage } from "@/app/ad/[slug]/page";
import { invalidateTags } from "@/lib/cache";
import { adDescriptionFromText, adPageTitle, adRobots, cleanAdText } from "@/lib/seo/ad-seo";
import { listingJsonLd } from "@/lib/seo/schema";
import { pageMetadata } from "@/lib/ui/meta";
import { revalidateListingPages } from "@/server/listings/revalidate";
import { ENDED_PAGE_DAYS, endedAt, listingVisibility } from "@/server/listings/visibility";
import { loadEndedAd } from "@/server/listings/ended-ad";
import { Category, Listing, Location, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  delete process.env.SITE_NOINDEX;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  queued.length = 0;
  invalidateTags(["site", "categories", "locations", "listings", "feed", "counts"]);
});

describe("H16.4 title, description and robots", () => {
  it("builds the title as <Ad title> in <City> - <Category> | Tharkoo and cuts a long title at a word", () => {
    expect(adPageTitle({ title: "Coffee and long walks", city: "Surat", category: "Dating" })).toBe("Coffee and long walks in Surat - Dating | Tharkoo");
    expect(adPageTitle({ title: "Office assistant", category: "Jobs" })).toBe("Office assistant - Jobs | Tharkoo");
    const long = adPageTitle({ title: "A very long title that goes on and on about nothing in particular for a long while", city: "Pune", category: "Jobs" });
    expect(long.endsWith("... in Pune - Jobs | Tharkoo")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(110);
  });

  it("takes the description from the ad's own words, about 150 characters, with no links, e-mail or phone numbers", () => {
    const text = "Looking for an office assistant for a small team in Surat. Call 98765 43210 or write to boss@example.com or see https://example.com/job for the full details of the work and the hours we need.";
    const description = adDescriptionFromText(text, "fallback");
    expect(description.length).toBeLessThanOrEqual(150);
    expect(description.startsWith("Looking for an office assistant for a small team in Surat.")).toBe(true);
    expect(description).not.toMatch(/example\.com|98765|@/);
    expect(cleanAdText("<b>Hi</b>   there")).toBe("Hi there");
  });

  it("falls back to the generic description when the ad has almost no text", () => {
    expect(adDescriptionFromText("Hi", "generic text")).toBe("generic text");
    expect(adDescriptionFromText(undefined, "generic text")).toBe("generic text");
  });

  it("indexes a live ad that is set to be indexed or a sample ad, never an ended one, and keeps people photos out of image search", () => {
    expect(adRobots({ access: "live", indexed: true, sample: false, people: false })).toEqual({ index: true, follow: true, noimageindex: false });
    expect(adRobots({ access: "live", indexed: false, sample: true, people: false }).index).toBe(true);
    expect(adRobots({ access: "live", indexed: false, sample: false, people: false }).index).toBe(false);
    expect(adRobots({ access: "ended", indexed: true, sample: false, people: false }).index).toBe(false);
    expect(adRobots({ access: "live", indexed: true, sample: false, people: true }).noimageindex).toBe(true);
    const meta = pageMetadata({ title: "t", description: "d", path: "/x/", noImageIndex: true });
    expect(meta.robots).toMatchObject({ index: true, follow: true, noimageindex: true });
    expect(pageMetadata({ title: "t", description: "d", path: "/x/" }).robots).not.toHaveProperty("noimageindex");
  });
});

describe("H16.4 JobPosting", () => {
  const base = { category: "jobs", name: "Office assistant", description: "A weekday office role.", url: "https://tharkoo.example/ad/x/", datePosted: "2026-11-10T00:00:00.000Z", validThrough: "2026-11-13T00:00:00.000Z", hiringOrganization: "Patel Traders", jobLocation: "Surat" };

  it("has the JobPosting shape with the ad's end date as validThrough, and only fields the ad really has", () => {
    const node = listingJsonLd(base) as Record<string, unknown>;
    expect(node).toMatchObject({ "@context": "https://schema.org", "@type": "JobPosting", title: "Office assistant", validThrough: "2026-11-13T00:00:00.000Z", hiringOrganization: { "@type": "Organization", name: "Patel Traders" }, jobLocation: { "@type": "Place", name: "Surat" } });
    expect(Object.keys(node).sort()).toEqual(["@context", "@type", "datePosted", "description", "hiringOrganization", "jobLocation", "title", "url", "validThrough"]);
  });

  it("is left out when a required field is missing, never published half-filled", () => {
    expect(listingJsonLd({ ...base, hiringOrganization: undefined })).toBeNull();
    expect(listingJsonLd({ ...base, validThrough: undefined })).toBeNull();
  });

  it("another category gets an Offer only where the ad has a price", () => {
    const withPrice = listingJsonLd({ category: "buy-and-sell", name: "Sofa", description: "A sofa.", url: "https://tharkoo.example/ad/s/", price: 5000 }) as { offers?: unknown };
    const without = listingJsonLd({ category: "buy-and-sell", name: "Sofa", description: "A sofa.", url: "https://tharkoo.example/ad/s/" }) as { offers?: unknown };
    expect(withPrice.offers).toBeTruthy();
    expect(without.offers).toBeUndefined();
  });
});

describe("H16.4 an ended ad stays for 30 days, then 410", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");

  it("answers ended for an expired ad for 30 days, then gone; an owner-deleted ad is gone at once", () => {
    expect(listingVisibility({ status: "expired", expiresAt: new Date(now - 2 * DAY) }, now)).toBe("ended");
    expect(listingVisibility({ status: "active", expiresAt: new Date(now - 1000) }, now)).toBe("ended");
    expect(listingVisibility({ status: "expired", expiresAt: new Date(now - (ENDED_PAGE_DAYS - 1) * DAY) }, now)).toBe("ended");
    expect(listingVisibility({ status: "expired", expiresAt: new Date(now - (ENDED_PAGE_DAYS + 1) * DAY) }, now)).toBe("gone");
    expect(listingVisibility({ status: "deleted", updatedAt: new Date(now - DAY) }, now)).toBe("gone");
  });

  it("a removed ad counts from the day it was removed", () => {
    expect(listingVisibility({ status: "removed", updatedAt: new Date(now - 3 * DAY), expiresAt: new Date(now + 5 * DAY) }, now)).toBe("ended");
    expect(listingVisibility({ status: "removed", updatedAt: new Date(now - 31 * DAY) }, now)).toBe("gone");
    expect(endedAt({ status: "removed", updatedAt: new Date(now - DAY) })).toBe(now - DAY);
  });

  it("a live, a pending and an unknown ad are unchanged", () => {
    expect(listingVisibility({ status: "active", expiresAt: new Date(now + DAY) }, now)).toBe("live");
    expect(listingVisibility({ status: "pending" }, now)).toBe("missing");
    expect(listingVisibility(null, now)).toBe("missing");
  });

  async function world() {
    const owner = await User.create({ email: "seller@example.test", displayName: "Seller", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
    const jobs = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0 });
    const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", parentId: null, enabled: true, order: 0 });
    const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true, order: 0 });
    const make = (slug: string, status: "active" | "expired", extra: Record<string, unknown> = {}) =>
      Listing.create({ ownerId: owner._id, categoryId: jobs._id, stateId: state._id, cityId: surat._id, title: `Role ${slug}`, description: "SECRET description with a phone 9876543210", slug, status, seoNoindex: false, publishedAt: new Date(now - 5 * DAY), expiresAt: new Date(status === "expired" ? Date.now() - 2 * DAY : Date.now() + DAY), ...extra });
    return { make };
  }

  it("the page of an ended ad is 200 with noindex, says it is no longer available and shows similar ads, never the ad's own text", async () => {
    const w = await world();
    await w.make("live-one-k7q2", "active");
    await w.make("live-two-k7q3", "active");
    await w.make("old-role-k7q4", "expired");
    const meta = await adMetadata({ params: Promise.resolve({ slug: "old-role-k7q4" }) });
    expect(meta.title).toBe("This ad is no longer available | Tharkoo");
    expect(meta.robots).toMatchObject({ index: false });
    const view = await loadEndedAd("old-role-k7q4");
    expect(view).toMatchObject({ categorySlug: "jobs", citySlug: "surat" });
    expect(view!.similar.map((ad) => ad.slug).sort()).toEqual(["live-one-k7q2", "live-two-k7q3"]);
    expect(JSON.stringify({ ...view, similar: [] })).not.toContain("SECRET");
    const element = (await AdPage({ params: Promise.resolve({ slug: "old-role-k7q4" }) })) as { props: { view: unknown } };
    expect(JSON.stringify(element.props.view)).not.toContain("old-role-k7q4");
  });

  it("an ad ended more than 30 days ago is 404 for the page code (the proxy answers 410)", async () => {
    const w = await world();
    await w.make("ancient-k7q5", "expired", { expiresAt: new Date(Date.now() - 40 * DAY) });
    await expect(AdPage({ params: Promise.resolve({ slug: "ancient-k7q5" }) })).rejects.toThrow();
  });
});

describe("H16.4 IndexNow", () => {
  it("an ad that goes live, changes or ends is queued once for the search engines", async () => {
    await revalidateListingPages({ slug: "role-k7q2", status: "active" }, "jobs");
    await revalidateListingPages({ slug: "role-k7q2", status: "removed" }, "jobs");
    expect(queued).toEqual([["/ad/role-k7q2/"], ["/ad/role-k7q2/"]]);
    await revalidateListingPages({ slug: null, status: "active" }, "jobs");
    expect(queued).toHaveLength(2);
  });
});

describe("H16.4 people ads keep photos out of image search", () => {
  it("a live ad in a people category is index,follow,noimageindex and a goods ad is not", async () => {
    const owner = await User.create({ email: "p@example.test", displayName: "P", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
    const dating = await Category.create({ slug: "dating", name: "Dating", kind: "people", enabled: true, order: 0 });
    const bikes = await Category.create({ slug: "bikes", name: "Bikes", kind: "goods", enabled: true, order: 1 });
    const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", parentId: null, enabled: true, order: 0 });
    const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true, order: 0 });
    const make = (slug: string, category: mongoose.Types.ObjectId) =>
      Listing.create({ ownerId: owner._id, categoryId: category, stateId: state._id, cityId: surat._id, title: "Coffee and long walks", description: "Friendly person who likes long walks and good coffee in the evening.", slug, status: "active", seoNoindex: false, publishedAt: new Date(), expiresAt: new Date(Date.now() + DAY) });
    await make("people-ad-k7q2", dating._id);
    await make("bike-ad-k7q3", bikes._id);
    const people = await adMetadata({ params: Promise.resolve({ slug: "people-ad-k7q2" }) });
    const goods = await adMetadata({ params: Promise.resolve({ slug: "bike-ad-k7q3" }) });
    expect(people.robots).toMatchObject({ index: true, follow: true, noimageindex: true });
    expect(goods.robots).toMatchObject({ index: true, follow: true });
    expect(goods.robots).not.toHaveProperty("noimageindex");
    expect(people.title).toBe("Coffee and long walks in Surat - Dating | Tharkoo");
    expect(String(people.description)).toContain("Friendly person who likes long walks");
  });
});

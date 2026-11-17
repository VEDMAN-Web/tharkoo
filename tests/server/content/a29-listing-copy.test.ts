import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { listingHeading } from "@/lib/layout/listing";
import { getSeoFor, getSite } from "@/lib/queries";
import { fillTemplate } from "@/lib/seo";
import { fallbackLanding, mergeLanding, visibleHeading, type LandingCopy } from "@/lib/seo/landing";
import { hubCopy } from "@/lib/seo-site";
import { urlHeading } from "@/lib/seo/override";
import { explain, resolveListingCopy, type ListingCopyInput } from "@/server/content/listing-copy";
import { ContentItem, PageLayout, SeoTemplate, Site, UrlOverride } from "@/server/models";
import { getUrlOverride } from "@/server/urls/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["site", "layout:listing"]);
  await Site.create({ key: "default", name: "Tharkoo" });
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

const YEAR = new Date().getFullYear();
const CATEGORY: ListingCopyInput = { kind: "category", path: "/dating/", categorySlug: "dating", category: "Dating", count: 12 };
const PLACE: ListingCopyInput = { kind: "place", path: "/dating/pune/", categorySlug: "dating", category: "Dating", place: "Pune", state: "Maharashtra", count: 12, indexable: true, districts: ["Kothrud"] };

const stale = () => invalidateTags(["site", "layout:listing"]);
const setLandings = async (landings: Record<string, Partial<LandingCopy>>) => {
  await Site.updateOne({ key: "default" }, { $set: { landings } }, { strict: false });
  stale();
};
const setHeaderLayout = async (h1Template: string) => {
  const blocks = [{ id: "h", type: "listingHeader", visible: true, props: { h1Template, introTemplate: "" } }];
  await PageLayout.create({ key: "listing", scope: "default", draft: blocks, published: blocks, version: 1, publishedAt: new Date() });
  stale();
};

/** What the category page works out today (src/app/[category]/page.tsx), from the same helpers it uses. */
async function todayCategory() {
  const [seo, site] = await Promise.all([getSeoFor("category", "dating"), getSite()]);
  const over = await getUrlOverride("/dating/");
  const vars = { category: "Dating", site: site.name, year: YEAR };
  const title = over?.title?.trim() || fillTemplate(seo?.title || "{category} classifieds across India | Tharkoo", vars);
  const description = over?.description?.trim() || fillTemplate(seo?.description || "Browse {category} on Tharkoo: listings from people across Indian cities. Filter by city and district, see photos and contact posters directly.", vars);
  const copy = mergeLanding(fallbackLanding({ category: "Dating", count: 12, site: site.name }), (site as { landings?: Record<string, Partial<LandingCopy>> }).landings?.["dating|india"]);
  const hub = await hubCopy("/dating/", { intro: copy.intro || fillTemplate(seo?.intro || "", vars), faqs: copy.faqs });
  const heading = await urlHeading("/dating/", "Dating in India");
  const blocks = (await PageLayout.findOne({ key: "listing", scope: "default" }).lean<{ published: { type: string; props: { h1Template?: string } }[] }>())?.published;
  const template = blocks?.find((block) => block.type === "listingHeader")?.props.h1Template ?? "";
  const h1 = listingHeading(template, heading, { ...vars, count: 12, h1: heading });
  return { h1, intro: hub.intro, faqs: hub.faqs, title, description };
}

/** The same for /[category]/[location]/ (src/app/[category]/[location]/page.tsx). */
async function todayPlace() {
  const [seo, site] = await Promise.all([getSeoFor("location", "dating"), getSite()]);
  const over = await getUrlOverride("/dating/pune/");
  const vars = { category: "Dating", city: "Pune", state: "Maharashtra", count: 12, site: site.name, year: YEAR, districtPref: "" };
  const input = { category: "Dating", city: "Pune", count: 12, indexable: true, districts: ["Kothrud"], site: site.name };
  const landings = (site as { landings?: Record<string, Partial<LandingCopy>> }).landings;
  const copy = mergeLanding(fallbackLanding(input), landings?.["dating|pune"]);
  const hub = await hubCopy("/dating/pune/", { intro: copy.intro || fillTemplate(seo?.intro || "", vars), faqs: copy.faqs });
  const h1 = over?.h1?.trim() || visibleHeading(fillTemplate(seo?.h1 || "", vars), copy.h1);
  const title = over?.title?.trim() || fillTemplate(seo?.title || copy.title, vars);
  const description = over?.description?.trim() || fillTemplate(seo?.description || copy.description, vars);
  return { h1, intro: hub.intro, faqs: hub.faqs, title, description };
}

const faq = [{ q: "Is it free?", a: "Yes, for now." }];

async function expectToday(input: ListingCopyInput, today: () => Promise<Record<string, unknown>>) {
  const got = await resolveListingCopy(input);
  const want = await today();
  expect({ h1: got.h1, intro: got.intro, faqs: got.faqs, title: got.title, description: got.description }).toEqual(want);
  return got;
}

describe("listing copy resolver, legacy mode: the same words the pages give today (A29)", () => {
  it("source 6, code: nothing is saved, so every field is the built-in text", async () => {
    const got = await expectToday(CATEGORY, todayCategory);
    expect(got.sources).toEqual({ h1: "code", intro: "code", faqs: "code", title: "code", description: "code" });
    const place = await expectToday(PLACE, todayPlace);
    expect(place.sources).toEqual({ h1: "code", intro: "code", faqs: "code", title: "code", description: "code" });
    expect(place.h1).toBe("Dating in Pune");
  });

  it("source 3, Site.landings: the saved text beats the built-in text, field by field", async () => {
    await setLandings({ "dating|india": { intro: "Our Dating intro.", faqs: faq }, "dating|pune": { h1: "Dating near Pune in 2026", title: "Dating in Pune | Tharkoo", description: "Pune dating ads.", intro: "Pune intro." } });
    const got = await expectToday(CATEGORY, todayCategory);
    expect(got.sources).toMatchObject({ intro: "site-landing", faqs: "site-landing", h1: "code", title: "code" });
    const place = await expectToday(PLACE, todayPlace);
    expect(place.sources).toEqual({ h1: "site-landing", intro: "site-landing", faqs: "code", title: "site-landing", description: "site-landing" });
  });

  it("source 2, UrlOverride: the text saved for one URL beats Site.landings", async () => {
    await setLandings({ "dating|india": { intro: "Landing intro.", faqs: [{ q: "Landing?", a: "Yes." }] } });
    await UrlOverride.create({ path: "/dating/", h1: "Dating, done right", intro: "Override intro.", faq: faq, title: "Override title", description: "Override description" });
    await UrlOverride.create({ path: "/dating/pune/", h1: "Pune dating", intro: "Pune override.", title: "Pune title" });
    const got = await expectToday(CATEGORY, todayCategory);
    expect(got.sources).toEqual({ h1: "url-override", intro: "url-override", faqs: "url-override", title: "url-override", description: "url-override" });
    const place = await expectToday(PLACE, todayPlace);
    expect(place.sources).toMatchObject({ h1: "url-override", intro: "url-override", title: "url-override", description: "code" });
  });

  it("source 5, SEO template: it wins the title and description, and a place heading that says 'in'", async () => {
    await SeoTemplate.create({ pageType: "category", title: "{category} deals near you", description: "Find {category} deals on {site}.", h1: "{category} here", intro: "Template intro" });
    await SeoTemplate.create({ pageType: "location", title: "{category} in {city} | {site}", description: "{category} ads in {city}.", h1: "{category} in {city} today", intro: "x" });
    const got = await expectToday(CATEGORY, todayCategory);
    expect(got.sources).toMatchObject({ title: "seo-template", description: "seo-template", h1: "code", intro: "code" });
    const place = await expectToday(PLACE, todayPlace);
    expect(place.sources).toMatchObject({ h1: "seo-template", title: "seo-template", description: "seo-template" });
    expect(place.h1).toBe("Dating in Pune today");
  });

  it("a place template heading without the word 'in' is not used (as today)", async () => {
    await SeoTemplate.create({ pageType: "location", h1: "{category} {city}" });
    const place = await expectToday(PLACE, todayPlace);
    expect(place.sources.h1).toBe("code");
  });

  it("source 4, listingHeader: the heading template of the listing layout wraps the heading", async () => {
    await setHeaderLayout("Best {category} ads");
    const got = await expectToday(CATEGORY, todayCategory);
    expect(got.h1).toBe("Best Dating ads");
    expect(got.sources.h1).toBe("listing-header");
  });

  it("the plain {h1} template leaves the heading alone", async () => {
    await setHeaderLayout("{h1}");
    const got = await expectToday(CATEGORY, todayCategory);
    expect(got.sources.h1).toBe("code");
  });
});

describe("listing copy resolver, content mode (A29)", () => {
  const publish = (fields: Record<string, unknown>) =>
    ContentItem.create({ kind: "listingIntro", slug: "dating", path: "/dating/", status: "published", draft: { title: "Dating" }, published: { title: "Dating", ...fields }, version: 1 });

  it("source 1, content: the published listing text of the path comes first, then the layout and the built-in text", async () => {
    await setLandings({ "dating|india": { intro: "Landing intro." } });
    await UrlOverride.create({ path: "/dating/", intro: "Override intro." });
    await publish({ h1: "Dating from the editor", body: "Editor intro.", faq: faq, seo: { title: "Editor title", description: "Editor description" } });
    const got = await resolveListingCopy({ ...CATEGORY, mode: "content" });
    expect(got).toMatchObject({ h1: "Dating from the editor", intro: "Editor intro.", faqs: faq, title: "Editor title", description: "Editor description", source: "content" });
    expect(got.sources).toEqual({ h1: "content", intro: "content", faqs: "content", title: "content", description: "content" });
  });

  it("without a content item it ignores the old sources and falls to the layout, the SEO template and the built-in text", async () => {
    await setLandings({ "dating|india": { intro: "Landing intro." } });
    await UrlOverride.create({ path: "/dating/", intro: "Override intro.", h1: "Override h1" });
    await SeoTemplate.create({ pageType: "category", title: "{category} deals" });
    const got = await resolveListingCopy({ ...CATEGORY, mode: "content" });
    expect(got.sources).toEqual({ h1: "code", intro: "code", faqs: "code", title: "seo-template", description: "code" });
    expect(got.intro).toBe(fallbackLanding({ category: "Dating", count: 12, site: "Tharkoo" }).intro);
  });

  it("a draft or unpublished item is not used", async () => {
    await ContentItem.create({ kind: "listingIntro", slug: "dating", path: "/dating/", status: "draft", draft: { title: "Dating", h1: "Draft h1" }, published: null, version: 1 });
    const got = await resolveListingCopy({ ...CATEGORY, mode: "content" });
    expect(got.sources.h1).toBe("code");
  });

  it("follows Site.listingCopySource when the call does not name a mode", async () => {
    await publish({ h1: "From the editor", body: "Editor intro." });
    expect((await resolveListingCopy(CATEGORY)).sources.intro).toBe("code");
    await Site.updateOne({ key: "default" }, { $set: { listingCopySource: "content" } });
    stale();
    expect((await resolveListingCopy(CATEGORY)).sources.intro).toBe("content");
  });
});

describe("explain (A29)", () => {
  it("lists every source that has text for each field, the winner first", async () => {
    await setLandings({ "dating|india": { intro: "Landing intro." } });
    await UrlOverride.create({ path: "/dating/", intro: "Override intro." });
    const out = await explain(CATEGORY);
    expect(out.mode).toBe("legacy");
    expect(out.source).toBe("url-override");
    expect(out.candidates.intro.map((row) => row.source)).toEqual(["url-override", "site-landing", "code"]);
    expect(out.candidates.intro[0].text).toBe("Override intro.");
    expect(out.candidates.h1.map((row) => row.source)).toEqual(["code"]);
    expect(out.candidates.faqs.map((row) => row.source)).toEqual(["code"]);
  });
});

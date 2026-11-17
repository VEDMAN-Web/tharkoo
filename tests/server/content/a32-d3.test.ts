import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { applyListingCopyMigration, planListingCopyMigration, slugOfPath } from "@/server/content/d3-listing-copy";
import { resolveListingCopy, type ListingCopyInput } from "@/server/content/listing-copy";
import { AuditEvent, Category, ContentItem, ContentRevision, Location, SeoTemplate, Site, UrlOverride } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["site", "layout:listing"]);
  await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0, fields: [], minListingsIndex: 1 });
  await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 1, fields: [], minListingsIndex: 1 });
  const state = await Location.create({ type: "state", slug: "maharashtra", name: "Maharashtra", parentId: null, enabled: true, order: 0 });
  await Location.create({ type: "city", slug: "pune", name: "Pune", parentId: state._id, enabled: true, order: 0 });
  await Site.create({ key: "default", name: "Tharkoo" });
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

const faq = [{ q: "Is it free?", a: "Yes, for now." }];
const setLandings = async (landings: Record<string, unknown>) => {
  await Site.updateOne({ key: "default" }, { $set: { landings } }, { strict: false });
  invalidateTags(["site"]);
};
const entryOf = async (path: string) => (await planListingCopyMigration()).entries.find((entry) => entry.path === path);

describe("D3 dry run (A32)", () => {
  it("lists every old source with text, the winner of today's order, and the record it would write, and writes nothing", async () => {
    await UrlOverride.create({ path: "/dating/", h1: "Dating, done right", intro: "Override intro.", faq, title: "Override title" });
    await setLandings({ "dating|india": { intro: "Landing intro.", faqs: [{ q: "Landing?", a: "Yes." }], h1: "Never used", title: "Never used too" } });
    const plan = await planListingCopyMigration();
    const entry = plan.entries.find((item) => item.path === "/dating/")!;
    expect(entry.kind).toBe("category");
    expect(entry.sources.map((item) => item.source)).toEqual(["url-override", "site-landing"]);
    expect(entry.winners).toEqual({ h1: "url-override", intro: "url-override", faqs: "url-override", title: "url-override" });
    expect(entry.record).toEqual({ title: "/dating/", h1: "Dating, done right", body: "Override intro.", faq, seo: { title: "Override title" } });
    expect(entry.conflicts.join(" ")).toMatch(/Both the per-URL text and Site.landings have an intro/);
    expect(entry.conflicts.join(" ")).toMatch(/never used/i);
    expect(entry.status).toBe("new");
    expect(plan.totals).toMatchObject({ urls: 1, new: 1 });
    expect(await ContentItem.countDocuments({})).toBe(0);
  });

  it("a city page takes the landing heading, title and description when no URL text or SEO template says otherwise", async () => {
    await setLandings({ "dating|pune": { h1: "Dating near Pune", intro: "Pune intro.", title: "Pune dating | Tharkoo", description: "Pune dating ads." } });
    const entry = (await entryOf("/dating/pune/"))!;
    expect(entry.kind).toBe("place");
    expect(entry.winners).toEqual({ h1: "site-landing", intro: "site-landing", title: "site-landing", description: "site-landing" });
    expect(entry.record).toEqual({ title: "/dating/pune/", h1: "Dating near Pune", body: "Pune intro.", seo: { title: "Pune dating | Tharkoo", description: "Pune dating ads." } });
  });

  it("does not copy a landing heading, title or description that a SEO template would show first, and says so", async () => {
    await SeoTemplate.create({ pageType: "location", title: "{category} in {city}", description: "x", h1: "{category} in {city} today" });
    await setLandings({ "dating|pune": { h1: "Landing h1", intro: "Pune intro.", title: "Landing title", description: "Landing description" } });
    const entry = (await entryOf("/dating/pune/"))!;
    expect(entry.record).toEqual({ title: "/dating/pune/", body: "Pune intro." });
    expect(entry.conflicts).toHaveLength(3);
  });

  it("lists pages it leaves alone: district pages, other pages and keys with no page", async () => {
    await UrlOverride.create({ path: "/dating/pune/kothrud/", intro: "District text." });
    await UrlOverride.create({ path: "/contact/", h1: "Contact us" });
    await setLandings({ "dating|nowhere": { intro: "Lost text." }, "unknown|india": { intro: "Lost too." } });
    const plan = await planListingCopyMigration();
    expect(plan.entries).toEqual([]);
    expect(plan.skipped).toEqual([{ path: "/dating/pune/kothrud/", why: expect.stringMatching(/District pages/) }]);
    expect(plan.unmapped.sort()).toEqual(["dating|nowhere", "unknown|india"]);
  });

  it("counts the old fields no page reads, and leaves them alone", async () => {
    await Category.updateOne({ slug: "jobs" }, { $set: { introHtml: "<p>old</p>" } });
    await Location.updateOne({ slug: "pune" }, { $set: { landingHtml: "<p>old</p>" } });
    const plan = await planListingCopyMigration();
    expect(plan.dead).toEqual({ categories: 1, locations: 1 });
    expect((await Category.findOne({ slug: "jobs" }).lean())?.introHtml).toBe("<p>old</p>");
  });

  it("marks a page that already has listing text as 'exists' and never touches it", async () => {
    await UrlOverride.create({ path: "/jobs/", intro: "Override intro." });
    await ContentItem.create({ kind: "listingIntro", slug: "mine", path: "/jobs/", status: "published", draft: { title: "Jobs" }, published: { title: "Jobs", body: "Editor text." }, version: 1 });
    const entry = (await entryOf("/jobs/"))!;
    expect(entry.status).toBe("exists");
    const plan = await planListingCopyMigration();
    expect((await applyListingCopyMigration(plan)).written).toBe(0);
    expect((await ContentItem.findOne({ path: "/jobs/" }).lean<{ published: { body: string } }>())?.published.body).toBe("Editor text.");
  });
});

describe("D3 apply (A32)", () => {
  it("writes one published item and one revision per page, an audit line, and a second run writes nothing", async () => {
    await UrlOverride.create({ path: "/dating/", h1: "Dating, done right", intro: "Override intro.", faq });
    await setLandings({ "dating|pune": { intro: "Pune intro." } });
    const first = await applyListingCopyMigration(await planListingCopyMigration());
    expect(first.written).toBe(2);
    const item = await ContentItem.findOne({ path: "/dating/" }).lean<{ slug: string; status: string; version: number; published: { h1: string; body: string }; lastEditedBy: string }>();
    expect(item).toMatchObject({ slug: slugOfPath("/dating/"), status: "published", version: 1, lastEditedBy: "D3" });
    expect(item?.published).toMatchObject({ h1: "Dating, done right", body: "Override intro." });
    expect(await ContentRevision.countDocuments({})).toBe(2);
    expect(await AuditEvent.countDocuments({ action: "content.d3.apply" })).toBe(1);
    expect((await applyListingCopyMigration(await planListingCopyMigration())).written).toBe(0);
    expect(await UrlOverride.countDocuments({ path: "/dating/" })).toBe(1);
  });

  it("with the switch on, the resolver gives the same words as the old sources gave before (same H1 and intro on the fixtures)", async () => {
    await UrlOverride.create({ path: "/dating/", h1: "Dating, done right", intro: "Override intro.", faq, title: "Override title", description: "Override description" });
    await UrlOverride.create({ path: "/dating/pune/", intro: "Pune override intro." });
    await setLandings({ "dating|india": { intro: "Landing intro that loses.", faqs: [{ q: "Landing?", a: "Yes." }] }, "dating|pune": { h1: "Dating near Pune", title: "Pune dating | Tharkoo", description: "Pune dating ads.", faqs: [{ q: "In Pune?", a: "Yes." }] } });
    const category: ListingCopyInput = { kind: "category", path: "/dating/", categorySlug: "dating", category: "Dating", count: 12 };
    const place: ListingCopyInput = { kind: "place", path: "/dating/pune/", categorySlug: "dating", category: "Dating", place: "Pune", state: "Maharashtra", count: 12, indexable: true };
    const before = [await resolveListingCopy({ ...category, mode: "legacy" }), await resolveListingCopy({ ...place, mode: "legacy" })];
    await applyListingCopyMigration(await planListingCopyMigration());
    invalidateTags(["site"]);
    const after = [await resolveListingCopy({ ...category, mode: "content" }), await resolveListingCopy({ ...place, mode: "content" })];
    for (let index = 0; index < 2; index += 1) {
      expect({ h1: after[index].h1, intro: after[index].intro, faqs: after[index].faqs, title: after[index].title, description: after[index].description }).toEqual({
        h1: before[index].h1,
        intro: before[index].intro,
        faqs: before[index].faqs,
        title: before[index].title,
        description: before[index].description,
      });
    }
    expect(after[0].sources).toMatchObject({ h1: "content", intro: "content", faqs: "content", title: "content", description: "content" });
    expect(after[1].sources.intro).toBe("content");
  });
});

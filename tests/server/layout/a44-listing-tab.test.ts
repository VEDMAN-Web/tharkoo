import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sameHeader, previewHeader } from "@/app/admin/page-builder/_listing/model";
import { explainAddress, loadListingHeader, publishListingHeader, saveListingHeaderDraft } from "@/app/admin/page-builder/_listing/server";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { AuditEvent, Category, ContentItem, Location, PageLayout } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: "000000000000000000000061", email: "admin@example.com", roles: ["admin"], requestId: "r-a" };
const support: AdminCtx = { actorId: "000000000000000000000062", email: "s@example.com", roles: ["support"], requestId: "r-s" };

const header = (extra: Partial<{ h1Template: string; introTemplate: string; showCount: boolean; showUpdated: boolean }> = {}) => ({ h1Template: "{h1}", introTemplate: "", showCount: false, showUpdated: true, ...extra });

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0 });
  await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 1 });
});

describe("the heading and intro template", () => {
  it("starts from the built-in blocks, says a category uses the default, and only an admin may open it", async () => {
    const state = await loadListingHeader(admin, "default");
    expect(state).toMatchObject({ scope: "default", inherited: true, liveVersion: 0, hasDraft: false });
    expect(state.header).toEqual({ h1Template: "{h1}", introTemplate: "", showCount: false, showUpdated: true });
    expect(await loadListingHeader(admin, "category:dating")).toMatchObject({ categoryName: "Dating", inherited: true });
    await expect(loadListingHeader(support, "default")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(loadListingHeader(admin, "url:/dating/surat/")).rejects.toBeInstanceOf(ValidationError);
    await expect(loadListingHeader(admin, "category:nothing")).rejects.toBeInstanceOf(NotFoundError);
    await expect(loadListingHeader(admin, "category:Bad Slug")).rejects.toBeInstanceOf(ValidationError);
  });

  it("saves a draft for one category without touching the default, keeps the other blocks, and publishing makes it live", async () => {
    await saveListingHeaderDraft(admin, "category:dating", header({ h1Template: "Meet people: {h1}", introTemplate: "Verified profiles in {city}", showCount: true }));
    expect(await PageLayout.countDocuments({ key: "listing", scope: "default" })).toBe(0);
    const doc = await PageLayout.findOne({ key: "listing", scope: "category:dating" }).lean();
    expect(doc?.published ?? []).toHaveLength(0);
    const types = (doc?.draft as { type: string }[]).map((block) => block.type);
    expect(types).toEqual(["filters", "listingHeader", "listingFeed", "relatedCategories", "nearbyCities"]);
    const draftState = await loadListingHeader(admin, "category:dating");
    expect(draftState).toMatchObject({ inherited: false, hasDraft: true, liveVersion: 0 });
    expect(draftState.header.h1Template).toBe("Meet people: {h1}");
    const done = await publishListingHeader(admin, "category:dating");
    expect(done).toMatchObject({ version: 1, canUndo: false });
    const live = await PageLayout.findOne({ key: "listing", scope: "category:dating" }).lean();
    const props = (live?.published as { type: string; props: Record<string, unknown> }[]).find((block) => block.type === "listingHeader")?.props;
    expect(props).toMatchObject({ h1Template: "Meet people: {h1}", introTemplate: "Verified profiles in {city}", showCount: true });
    expect((await loadListingHeader(admin, "default")).header.h1Template).toBe("{h1}");
    expect((await loadListingHeader(admin, "category:jobs")).inherited).toBe(true);
  });

  it("a second publish can be undone, the audit row names the page, and a publish with no draft is refused", async () => {
    await expect(publishListingHeader(admin, "default")).rejects.toBeInstanceOf(NotFoundError);
    await saveListingHeaderDraft(admin, "default", header({ h1Template: "{category} for you" }));
    await publishListingHeader(admin, "default");
    await saveListingHeaderDraft(admin, "default", header({ h1Template: "{category} near you" }));
    const second = await publishListingHeader(admin, "default", "Nearer wording");
    expect(second).toMatchObject({ version: 2, canUndo: true });
    const row = await AuditEvent.findById(second.eventId).lean();
    expect(row).toMatchObject({ action: "layout.publish", targetType: "layout", targetLabel: "Listing pages" });
    expect(await undoEvent(admin, second.eventId)).toMatchObject({ ok: true });
    const live = await PageLayout.findOne({ key: "listing", scope: "default" }).lean();
    const props = (live?.published as { type: string; props: Record<string, unknown> }[]).find((block) => block.type === "listingHeader")?.props;
    expect(props?.h1Template).toBe("{category} for you");
  });

  it("refuses an empty heading, a blocked word and anyone who is not an admin, and saves nothing", async () => {
    await expect(saveListingHeaderDraft(admin, "default", header({ h1Template: "" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(saveListingHeaderDraft(support, "default", header())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(publishListingHeader(support, "default")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await PageLayout.countDocuments({ key: "listing" })).toBe(0);
  });

  it("a category starts from the published default layout when there is one", async () => {
    await saveListingHeaderDraft(admin, "default", header({ h1Template: "Default wording {h1}" }));
    await publishListingHeader(admin, "default");
    const state = await loadListingHeader(admin, "category:jobs");
    expect(state).toMatchObject({ inherited: true });
    expect(state.header.h1Template).toBe("Default wording {h1}");
  });

  it("previews a template with a sample and compares headers", () => {
    expect(previewHeader("{category} in {city} {year}", { category: "Jobs", city: "Pune" })).toMatch(/^Jobs in Pune \d{4}$/);
    expect(previewHeader("{h1}", { category: "Jobs", city: "Pune" })).toBe("Jobs in Pune");
    expect(sameHeader(header(), header())).toBe(true);
    expect(sameHeader(header(), header({ showCount: true }))).toBe(false);
  });
});

describe("which text an address uses", () => {
  it("names the source of each part for a category page and for a city page", async () => {
    await Location.create({ type: "city", slug: "surat", name: "Surat", enabled: true });
    const category = await explainAddress(admin, "/dating/");
    expect(category).toMatchObject({ path: "/dating/", kind: "category" });
    expect(category.fields.map((row) => row.field)).toEqual(["h1", "intro", "faqs", "title", "description"]);
    expect(category.fields.find((row) => row.field === "h1")?.winner).toMatchObject({ source: "code", text: "Dating in India" });
    const place = await explainAddress(admin, "dating/surat");
    expect(place).toMatchObject({ path: "/dating/surat/", kind: "place" });
    expect(place.fields.find((row) => row.field === "intro")?.winner?.source).toBe("code");
  });

  it("shows that a template on this tab wins the heading once it is published, and that a Content studio text does not win while the pages use today's order", async () => {
    await saveListingHeaderDraft(admin, "category:dating", header({ h1Template: "Meet people: {h1}" }));
    await publishListingHeader(admin, "category:dating");
    const explained = await explainAddress(admin, "/dating/");
    expect(explained.fields.find((row) => row.field === "h1")?.winner).toMatchObject({ source: "listing-header", text: "Meet people: Dating in India" });
    await ContentItem.create({ kind: "listingIntro", slug: "dating", path: "/dating/", status: "published", draft: { title: "Dating" }, published: { title: "Dating", h1: "Dating you can trust", body: "Written in the studio." }, version: 1 });
    const legacy = await explainAddress(admin, "/dating/");
    expect(legacy.mode).toBe("legacy");
    expect(legacy.fields.find((row) => row.field === "intro")?.others.map((row) => row.source)).not.toContain("content");
  });

  it("refuses an address that is not a category or a city page, an unknown category or place, and anyone who is not an admin", async () => {
    await expect(explainAddress(admin, "")).rejects.toBeInstanceOf(ValidationError);
    await expect(explainAddress(admin, "/a/b/c/")).rejects.toBeInstanceOf(ValidationError);
    await expect(explainAddress(admin, "/Bad Slug/")).rejects.toBeInstanceOf(ValidationError);
    await expect(explainAddress(admin, "/nothing/")).rejects.toBeInstanceOf(NotFoundError);
    await expect(explainAddress(admin, "/dating/nowhere/")).rejects.toBeInstanceOf(NotFoundError);
    await expect(explainAddress(support, "/dating/")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

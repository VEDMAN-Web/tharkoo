import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cache", () => ({ refreshPublicCache: async () => undefined }));

import { can } from "@/lib/admin/perms";
import { screenForPath } from "@/lib/admin/screens";
import type { AdminCtx } from "@/server/admin/context";
import { deleteRecord, fieldChoices, getRecord, listRecords, parseRecordsQuery, saveRecord } from "@/server/admin/records";
import { builtInScreen, listBuiltIns } from "@/server/content/studio/builtin";
import { findMediaUsages, mediaUsageCounts } from "@/server/layout/media-refs";
import { coverOf } from "@/components/new/blog-cover-data";
import { emptyValues, KINDS } from "@/lib/admin/record-kinds";
import { ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, BlogPost, Category, HelpArticle, SiteMedia } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ctx = (roles: string[]): AdminCtx => ({ actorId: String(new mongoose.Types.ObjectId()), email: "staff@example.test", roles, requestId: "r" });
const query = () => parseRecordsQuery({});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  await BlogPost.create([
    { slug: "stay-safe", title: "Stay safe when you meet", body: "Meet in public first.", category: "Safety", status: "published" },
    { slug: "old-note", title: "An old note", body: "Old.", status: "draft" },
  ]);
  await HelpArticle.create([{ slug: "how-to-post", title: "How to post an ad", body: "Open Post your ad.", section: "Getting started", order: 1, status: "published" }]);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("H8.58 built-in blog posts and help topics in the Content studio", () => {
  it("lists the records the site shows today for each tab, with their status and group", async () => {
    const posts = await listBuiltIns("blog");
    expect(posts.map((row) => row.slug).sort()).toEqual(["old-note", "stay-safe"]);
    expect(posts.find((row) => row.slug === "stay-safe")).toMatchObject({ title: "Stay safe when you meet", status: "published", group: "Safety" });
    expect(posts.find((row) => row.slug === "old-note")?.status).toBe("draft");
    expect(await listBuiltIns("help")).toEqual([expect.objectContaining({ slug: "how-to-post", group: "Getting started", status: "published" })]);
    expect(builtInScreen("blog")).toBe("/admin/blog-posts/");
    expect(builtInScreen("help")).toBe("/admin/help-topics/");
  });

  it("narrows the list by the status chip and the search words", async () => {
    const slugs = async (filter: Parameters<typeof listBuiltIns>[1]) => (await listBuiltIns("blog", filter)).map((row) => row.slug);
    expect(await slugs({ status: "draft" })).toEqual(["old-note"]);
    expect(await slugs({ status: "published" })).toEqual(["stay-safe"]);
    expect(await slugs({ status: "review" })).toEqual([]);
    expect(await slugs({ status: "scheduled" })).toEqual([]);
    expect(await slugs({ q: "OLD NOTE" })).toEqual(["old-note"]);
    expect(await slugs({ status: "published", q: "old" })).toEqual([]);
    expect(await slugs({ q: "(.*" })).toEqual([]);
  });

  it("filters the Blog posts table by status, with the search words too", async () => {
    const slugs = async (params: Record<string, string>) => (await listRecords(["seo_editor"], "blog-posts", parseRecordsQuery(params))).rows.map((row) => row.values.slug).sort();
    expect(await slugs({ status: "published" })).toEqual(["stay-safe"]);
    expect(await slugs({ status: "draft" })).toEqual(["old-note"]);
    expect(await slugs({ status: "published", q: "old" })).toEqual([]);
    expect(await slugs({ status: "nonsense" })).toEqual(["old-note", "stay-safe"]);
  });

  it("starts a new post with today's date and shows a cover only from https or this site's uploads", () => {
    expect(emptyValues(KINDS["blog-posts"]).date).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    expect(coverOf({ cover: "https://example.test/a.png" })?.src).toBe("https://example.test/a.png");
    expect(coverOf({ cover: "/uploads/0123456789abcdef01234567.png" })?.src).toBe("/uploads/0123456789abcdef01234567.png");
    expect(coverOf({ cover: "//elsewhere.test/a.png" })).toBeNull();
    expect(coverOf({ cover: "http://example.test/a.png" })).toBeNull();
    expect(coverOf({ cover: "/admin/a.png" })).toBeNull();
  });

  it("counts a library picture used as a blog cover, so it cannot be deleted from under the post", async () => {
    const url = "/uploads/0123456789abcdef01234567.png";
    const media = await SiteMedia.create({ url, objectKey: "site/cover.png", alt: "A desk", width: 10, height: 10, bytes: 10, contentType: "image/png", uploadedBy: "staff@example.test" });
    const id = String(media._id);
    expect(await findMediaUsages(id)).toEqual([]);
    await BlogPost.updateOne({ slug: "old-note" }, { $set: { cover: url } });
    expect(await findMediaUsages(id)).toEqual([expect.objectContaining({ kind: "blog", key: "old-note", label: "An old note", where: "draft" })]);
    expect((await mediaUsageCounts([id])).get(id)).toBe(1);
    await SiteMedia.deleteMany({});
  });

  it("offers the site's top categories as the blog category choices", async () => {
    const jobs = await Category.create({ slug: "jobs", name: "Jobs", order: 2 });
    await Category.create({ slug: "property", name: "Property", order: 1 });
    await Category.create({ slug: "hidden", name: "Hidden", enabled: false });
    await Category.create({ slug: "part-time", name: "Part time", parentId: jobs._id });
    expect((await fieldChoices(["blog_editor"], "blog-posts")).category.map((option) => option.value)).toEqual(["Property", "Jobs"]);
    expect(await fieldChoices(["content_editor"], "help-topics")).toEqual({});
  });

  it("opens, edits and removes a built-in post, each change in the audit log", async () => {
    const editor = ctx(["seo_editor"]);
    const list = await listRecords(editor.roles, "blog-posts", query());
    expect(list.total).toBe(2);
    const id = list.rows.find((row) => row.values.slug === "stay-safe")!.id;
    const detail = await getRecord(editor.roles, "blog-posts", id);
    const changed = await saveRecord(editor, "blog-posts", { id, values: { ...detail.values, title: "Stay safe when you meet someone" } });
    expect(changed.name).toBe("Stay safe when you meet someone");
    expect((await BlogPost.findById(id).lean())?.title).toBe("Stay safe when you meet someone");
    await deleteRecord(editor, "blog-posts", id);
    expect(await BlogPost.findById(id)).toBeNull();
    expect(await AuditEvent.countDocuments({ action: { $in: ["blogpost.update", "blogpost.delete"] } })).toBe(2);
  });

  it("edits a built-in help topic through its own screen, and checks the web address", async () => {
    const editor = ctx(["blog_editor"]);
    const { rows } = await listRecords(editor.roles, "help-topics", query());
    const topic = rows[0];
    await saveRecord(editor, "help-topics", { id: topic.id, values: { ...topic.values, status: "draft" } });
    expect((await HelpArticle.findById(topic.id).lean())?.status).toBe("draft");
    const bad = await saveRecord(editor, "help-topics", { id: topic.id, values: { ...topic.values, slug: "Not A Slug" } }).catch((caught) => caught);
    expect(bad).toBeInstanceOf(ValidationError);
  });

  it("lets the content team open and edit, only publishers remove, and keeps everyone else out", async () => {
    expect(can(["content_editor"], "content.write")).toBe(true);
    const writer = ctx(["content_editor"]);
    const id = (await listRecords(writer.roles, "blog-posts", query())).rows[0].id;
    await expect(deleteRecord(writer, "blog-posts", id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await BlogPost.findById(id)).not.toBeNull();
    await expect(listRecords(["support"], "blog-posts", query())).rejects.toBeInstanceOf(ForbiddenError);
    expect(screenForPath("/admin/blog-posts/").view).toBe("content.write");
    expect(screenForPath("/admin/help-topics/").view).toBe("content.write");
  });
});

import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cache", () => ({ refreshPublicCache: async () => undefined }));

import { can } from "@/lib/admin/perms";
import { screenForPath } from "@/lib/admin/screens";
import type { AdminCtx } from "@/server/admin/context";
import { deleteRecord, getRecord, listRecords, parseRecordsQuery, saveRecord } from "@/server/admin/records";
import { builtInScreen, listBuiltIns } from "@/server/content/studio/builtin";
import { ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, BlogPost, HelpArticle } from "@/server/models";
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

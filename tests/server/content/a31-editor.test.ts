import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildFields, cleanNodes, keyed, toEditorState } from "@/app/admin/content/_studio/data";
import { linkInBody, linkInText, wrapLink, wrapMark } from "@/app/admin/content/_studio/links";
import type { AdminCtx } from "@/server/admin/context";
import { listContent, options, parseKind, parseStatus, readEditorItem, tabCounts } from "@/server/content/studio/admin";
import { createItem, publishItem, saveDraft } from "@/server/content/studio/service";
import { changeSlug } from "@/server/content/studio/slug";
import { findPhrase, linkedPaths, pickSuggestions, type LinkCandidate } from "@/server/content/studio/suggest";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { ContentItem, Redirect } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const editor: AdminCtx = { actorId: "000000000000000000000071", email: "meera@example.com", roles: ["seo_editor"], requestId: "r-1" };
const blogEditor: AdminCtx = { actorId: "000000000000000000000072", email: "kavya@example.com", roles: ["blog_editor"], requestId: "r-2" };
const support: AdminCtx = { actorId: "000000000000000000000073", email: "s@example.com", roles: ["support"], requestId: "r-3" };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

const candidates: LinkCandidate[] = [
  { label: "Property in Surat", path: "/property/surat/", ads: 511, terms: ["Surat", "Property"] },
  { label: "Jobs in Surat", path: "/jobs/surat/", ads: 40, terms: ["Surat", "Jobs"] },
  { label: "Flats for rent", path: "/property/flats-for-rent/", ads: 1240, terms: ["Flats for rent"] },
  { label: "Property", path: "/property/", ads: 9000, terms: ["Property"] },
];

describe("link suggestions", () => {
  it("finds whole words in any case and nothing inside other words", () => {
    expect(findPhrase("Renting in surat is easy", "Surat")).toBe("surat");
    expect(findPhrase("Suratkal is a town", "Surat")).toBeNull();
    expect(findPhrase("ab", "ab")).toBeNull();
    expect(findPhrase("a (Surat), b", "Surat")).toBe("Surat");
  });

  it("ranks the page that matches two of its words first, gives each phrase one page and never repeats a linked page", () => {
    const text = "Renting a flat in Surat: look at Property listings and flats for rent near the station.";
    const picked = pickSuggestions(text, candidates);
    expect(picked[0]).toMatchObject({ path: "/property/surat/", phrase: "Surat" });
    expect(picked.map((item) => item.phrase.toLowerCase())).toEqual([...new Set(picked.map((item) => item.phrase.toLowerCase()))]);
    expect(picked.map((item) => item.path)).toContain("/property/flats-for-rent/");
    const linked = pickSuggestions("See [Surat](/property/surat/) and Property in Surat jobs", candidates);
    expect(linked.map((item) => item.path)).not.toContain("/property/surat/");
    expect(linkedPaths("a [b](/x/) c [d](https://e.com)")).toEqual(new Set(["/x/"]));
    expect(pickSuggestions("nothing relevant here at all", candidates)).toEqual([]);
    expect(pickSuggestions(text, candidates, 1)).toHaveLength(1);
  });
});

describe("editor helpers", () => {
  it("puts bold, italic and links around the selection, or around a hint", () => {
    expect(wrapMark("one two three", 4, 7, "**")).toEqual({ value: "one **two** three", start: 6, end: 9 });
    expect(wrapMark("one", 3, 3, "*").value).toBe("one*text*");
    expect(wrapLink("go here now", 3, 7, "/blog/")).toMatchObject({ value: "go [here](/blog/) now" });
  });

  it("links the first free mention only, not inside a link already, and reports when there is none", () => {
    expect(linkInText("Surat is big. Surat is hot.", "Surat", "/p/")).toBe("[Surat](/p/) is big. Surat is hot.");
    expect(linkInText("[Surat](/x/) and Surat", "Surat", "/p/")).toBe("[Surat](/x/) and [Surat](/p/)");
    expect(linkInText("[Surat](/x/)", "Surat", "/p/")).toBeNull();
    const nodes = [
      { t: "h2" as const, text: "Surat" },
      { t: "p" as const, text: "nothing" },
      { t: "ul" as const, items: ["first", "Visit Surat today"] },
    ];
    expect(linkInBody(nodes, "Surat", "/p/")).toEqual([nodes[0], nodes[1], { t: "ul", items: ["first", "Visit [Surat](/p/) today"] }]);
    expect(linkInBody(nodes, "Mumbai", "/p/")).toBeNull();
  });

  it("drops empty blocks and list lines when saving, keeps what the form does not show, and removes empty optional fields", () => {
    expect(cleanNodes([{ t: "p", text: "  " }, { t: "p", text: " hi " }, { t: "ul", items: ["", " a "] }, { t: "ul", items: [""] }, { t: "img", mediaId: "", alt: "x" }, { t: "faq", items: [{ q: "q", a: "" }] }, { t: "ads", path: "/", label: "" }])).toEqual([{ t: "p", text: "hi" }, { t: "ul", items: ["a"] }]);
    const original = { title: "Old", h1: "Page heading", tags: ["a"], seo: { canonical: "/x/", title: "Old seo" }, excerpt: "old" };
    const state = { ...toEditorState(original), title: " New ", excerpt: "", seoTitle: "", noindex: true, body: keyed([{ t: "p", text: "Body" }]) };
    expect(buildFields(original, state)).toEqual({ title: "New", h1: "Page heading", tags: ["a"], seo: { canonical: "/x/", noindex: true }, body: { v: 1, nodes: [{ t: "p", text: "Body" }] } });
  });
});

describe("the list and the editor data", () => {
  it("lists one kind newest first, filters by status and words, counts the tabs, and reads an item with its pictures", async () => {
    const a = await createItem(editor, { kind: "blog", title: "Renting a flat in Surat" });
    const b = await createItem(editor, { kind: "blog", title: "Stay safe when you meet" });
    await createItem(editor, { kind: "help", title: "How promotion plans work" });
    await publishItem(editor, { itemId: b.itemId });
    expect(await tabCounts()).toEqual({ blog: 2, help: 1 });
    expect((await listContent("blog", {})).map((row) => row.title)).toEqual(["Stay safe when you meet", "Renting a flat in Surat"]);
    expect((await listContent("blog", { status: "published" })).map((row) => row.id)).toEqual([b.itemId]);
    expect((await listContent("blog", { q: "SURAT" })).map((row) => row.id)).toEqual([a.itemId]);
    expect((await listContent("blog", { q: "a.*" })).length).toBe(0);
    expect((await listContent("help", {})).map((row) => row.title)).toEqual(["How promotion plans work"]);
    const read = await readEditorItem(a.itemId);
    expect(read).toMatchObject({ kind: "blog", slug: "renting-a-flat-in-surat", status: "draft", version: 1, revisions: 0 });
    expect(await readEditorItem("nope")).toBeNull();
    expect(await readEditorItem(String(new mongoose.Types.ObjectId()))).toBeNull();
    expect(parseKind("help")).toBe("help");
    expect(parseKind("x")).toBe("blog");
    expect(parseStatus("review")).toBe("review");
    expect(parseStatus("x")).toBe("");
    expect(await options("author")).toEqual([]);
  });

  it("lists authors and categories to choose from", async () => {
    const author = await createItem(editor, { kind: "blog", title: "x" });
    await ContentItem.updateOne({ _id: author.itemId }, { $set: { kind: "author", "draft.title": "Kavya" } });
    expect(await options("author")).toEqual([{ id: author.itemId, title: "Kavya" }]);
  });
});

describe("saving the editor's fields", () => {
  it("saves the draft the editor builds and a blog editor can save but not publish", async () => {
    const made = await createItem(blogEditor, { kind: "blog", title: "Draft only" });
    const state = { ...toEditorState({ title: "Draft only" }), excerpt: "Short", body: keyed([{ t: "h2", text: "Before you visit" }, { t: "p", text: "Look at [flats](/property/surat/)." }]), seoTitle: "A title", seoDescription: "A description" };
    await saveDraft(blogEditor, { itemId: made.itemId, fields: buildFields({ title: "Draft only" }, state), expectedVersion: 1 });
    const read = await readEditorItem(made.itemId);
    expect(read?.fields).toMatchObject({ title: "Draft only", excerpt: "Short", seo: { title: "A title", description: "A description" } });
    await expect(publishItem(blogEditor, { itemId: made.itemId })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createItem(support, { kind: "blog", title: "No" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("changing the web address", () => {
  it("changes a draft address with no redirect, and a published address with a permanent redirect from the old one", async () => {
    const draft = await createItem(editor, { kind: "blog", title: "Draft post" });
    const first = await changeSlug(editor, { itemId: draft.itemId, slug: "Better Address" });
    expect(first.redirected).toBe(false);
    expect((await ContentItem.findById(draft.itemId).lean())?.slug).toBe("better-address");
    expect(await Redirect.countDocuments()).toBe(0);

    const live = await createItem(editor, { kind: "blog", title: "Live post" });
    await publishItem(editor, { itemId: live.itemId });
    const second = await changeSlug(editor, { itemId: live.itemId, slug: "live-post-2" });
    expect(second.redirected).toBe(true);
    const redirect = await Redirect.findOne({ fromPath: "/blog/live-post/" }).lean();
    expect(redirect?.toPath).toBe("/blog/live-post-2/");
    const third = await changeSlug(editor, { itemId: live.itemId, slug: "live-post-3" });
    expect(third.redirected).toBe(true);
    expect((await Redirect.findOne({ fromPath: "/blog/live-post/" }).lean())?.toPath).toBe("/blog/live-post-3/");
    expect((await Redirect.findOne({ fromPath: "/blog/live-post-2/" }).lean())?.toPath).toBe("/blog/live-post-3/");
  });

  it("refuses a taken, reserved, bad or unchanged address and people who may not write", async () => {
    const one = await createItem(editor, { kind: "blog", title: "First" });
    const two = await createItem(editor, { kind: "blog", title: "Second" });
    await expect(changeSlug(editor, { itemId: two.itemId, slug: "first" })).rejects.toBeInstanceOf(ConflictError);
    await expect(changeSlug(editor, { itemId: two.itemId, slug: "second" })).rejects.toBeInstanceOf(ConflictError);
    await expect(changeSlug(editor, { itemId: two.itemId, slug: "admin" })).rejects.toBeInstanceOf(ValidationError);
    await expect(changeSlug(editor, { itemId: two.itemId, slug: "  " })).rejects.toBeInstanceOf(ValidationError);
    await expect(changeSlug(support, { itemId: one.itemId, slug: "other" })).rejects.toBeInstanceOf(ForbiddenError);
    const author = await createItem(editor, { kind: "blog", title: "Someone" });
    await ContentItem.updateOne({ _id: author.itemId }, { $set: { kind: "legal" } });
    await expect(changeSlug(editor, { itemId: author.itemId, slug: "terms-x" })).rejects.toBeInstanceOf(ValidationError);
  });
});

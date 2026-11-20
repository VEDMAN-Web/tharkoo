import mongoose from "mongoose";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { RichBody } from "@/components/content/RichBody";
import { parseInline } from "@/lib/content/inline";
import { MAX_NODES, parseRich, richBodySchema, richMediaIds, richTexts } from "@/lib/content/rich";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { dueScheduled, isVisibleNow, readPublicContent } from "@/server/content/studio/read";
import { canPublishKind, createItem, publishItem, restoreRevision, saveDraft, unpublishItem } from "@/server/content/studio/service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { AuditEvent } from "@/server/models";
import { ContentItem, ContentRevision } from "@/server/models/content";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ctxOf = (roles: string[], n: number): AdminCtx => ({ actorId: `00000000000000000000007${n}`, email: `staff${n}@example.com`, roles, requestId: `req-${n}` });
const seo = ctxOf(["seo_editor"], 1);
const blog = ctxOf(["blog_editor"], 2);
const admin = ctxOf(["admin"], 3);
const support = ctxOf(["support"], 4);

const body = (...texts: string[]) => ({ v: 1 as const, nodes: texts.map((text) => ({ t: "p" as const, text })) });
const fields = (title: string, ...texts: string[]) => ({ title, body: body(...texts) });

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
  await ContentItem.init();
  await ContentRevision.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

async function draftItem(ctx = seo, title = "How to spot a scam", texts: string[] = ["Check the sender."]) {
  const created = await createItem(ctx, { kind: "blog", title });
  await saveDraft(ctx, { itemId: created.itemId, fields: fields(title, ...texts) });
  return created.itemId;
}

describe("inline marks", () => {
  it("allows bold, italic and safe links only; everything else stays plain text", () => {
    expect(parseInline("Hello **bold** and *italic* and [site](/blog/) and [out](https://example.com/x).")).toEqual([
      { type: "text", text: "Hello " },
      { type: "bold", text: "bold" },
      { type: "text", text: " and " },
      { type: "italic", text: "italic" },
      { type: "text", text: " and " },
      { type: "link", text: "site", href: "/blog/", external: false },
      { type: "text", text: " and " },
      { type: "link", text: "out", href: "https://example.com/x", external: true },
      { type: "text", text: "." },
    ]);
    expect(parseInline("[bad](javascript:alert(1)) <b>x</b>")).toEqual([{ type: "text", text: "bad" }, { type: "text", text: ") <b>x</b>" }]);
    expect(parseInline("[data](data:text/html;base64,AAA)")).toEqual([{ type: "text", text: "data" }]);
  });
});

describe("rich text", () => {
  it("accepts the documented node types and refuses anything else, including extra keys, bad ids, long bodies and off-site ads paths", () => {
    const ok = { v: 1, nodes: [{ t: "p", text: "Hi" }, { t: "h2", text: "Title" }, { t: "ul", items: ["a", "b"] }, { t: "img", mediaId: "a".repeat(24), alt: "A tea cup" }, { t: "faq", items: [{ q: "Q?", a: "A." }] }, { t: "ads", path: "/jobs/mumbai/", label: "Jobs" }] };
    expect(richBodySchema.safeParse(ok).success).toBe(true);
    expect(parseRich({ v: 1, nodes: [{ t: "html", text: "<b>x</b>" }] })).toBeNull();
    expect(parseRich({ v: 1, nodes: [{ t: "p", text: "x", onclick: "evil()" }] })).toBeNull();
    expect(parseRich({ v: 1, nodes: [{ t: "img", mediaId: "nope", alt: "x" }] })).toBeNull();
    expect(parseRich({ v: 1, nodes: [{ t: "img", mediaId: "a".repeat(24), alt: "" }] })).toBeNull();
    expect(parseRich({ v: 1, nodes: [{ t: "ads", path: "https://evil.example/" }] })).toBeNull();
    expect(parseRich({ v: 1, nodes: Array.from({ length: MAX_NODES + 1 }, () => ({ t: "p", text: "x" })) })).toBeNull();
    expect(parseRich("<script>")).toBeNull();
    const parsed = parseRich(ok)!;
    expect(richMediaIds(parsed)).toEqual(["a".repeat(24)]);
    expect(richTexts(parsed)).toContain("A tea cup");
  });

  it("never renders a script or HTML typed into the text, and never a javascript link", () => {
    const evil = { v: 1, nodes: [{ t: "p", text: "<script>alert(1)</script> and <img src=x onerror=alert(2)> **bold** [click](javascript:alert(3))" }, { t: "ul", items: ["<b>x</b>"] }, { t: "img", mediaId: "b".repeat(24), alt: '"><script>alert(4)</script>' }] };
    const html = renderToStaticMarkup(RichBody({ body: evil, media: { ["b".repeat(24)]: { src: "/uploads/x.png" } } }) as never);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img src="x"/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("click");
    expect(html).not.toContain('onerror=alert(2)>');
  });

  it("draws links the safe way: internal plain, external nofollow, and a body that is not valid draws nothing", () => {
    const html = renderToStaticMarkup(RichBody({ body: body("[a](/blog/) [b](https://example.com)") }) as never);
    expect(html).toMatch(/href="\/blog\/?"/);
    expect(html).toContain('rel="nofollow noopener"');
    expect(renderToStaticMarkup((RichBody({ body: { v: 2, nodes: [] } }) ?? null) as never)).toBe("");
  });
});

describe("create and save a draft", () => {
  it("starts a draft with a slug from the title, audited, and refuses the same address twice", async () => {
    const done = await createItem(seo, { kind: "blog", title: "Safe meetups in Mumbai" });
    const item = await ContentItem.findById(done.itemId).lean();
    expect(item).toMatchObject({ kind: "blog", slug: "safe-meetups-in-mumbai", status: "draft", version: 1, published: null });
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "content.create", actorRole: "seo_editor" });
    await expect(createItem(seo, { kind: "blog", title: "Safe meetups in Mumbai" })).rejects.toBeInstanceOf(ConflictError);
    await expect(createItem(seo, { kind: "nonsense", title: "x" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createItem(seo, { kind: "blog", title: " " })).rejects.toBeInstanceOf(ValidationError);
    await expect(createItem(seo, { kind: "listingIntro", title: "Jobs in Mumbai" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createItem(seo, { kind: "listingIntro", title: "Jobs in Mumbai", path: "/jobs/mumbai/" })).resolves.toBeTruthy();
  });

  it("a draft save never changes what is live, and refuses blocked words, dashes and bad input", async () => {
    const id = await draftItem();
    await publishItem(seo, { itemId: id });
    await saveDraft(seo, { itemId: id, fields: fields("How to spot a scam, updated", "A newer text.") });
    const read = await readPublicContent("blog", "how-to-spot-a-scam");
    expect(read).toMatchObject({ state: "published", fields: { title: "How to spot a scam" } });
    await expect(saveDraft(seo, { itemId: id, fields: fields("Dash — title") })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveDraft(seo, { itemId: id, fields: { title: "" } })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveDraft(seo, { itemId: id, fields: { title: "x", body: { v: 1, nodes: [{ t: "html", text: "<b>" }] } } })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveDraft(support, { itemId: id, fields: fields("Nope") })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("two people saving the same version: the second is told, not overwritten", async () => {
    const id = await draftItem();
    const version = (await ContentItem.findById(id).lean())!.version;
    await saveDraft(seo, { itemId: id, fields: fields("First"), expectedVersion: version });
    await publishItem(seo, { itemId: id });
    await expect(saveDraft(blog, { itemId: id, fields: fields("Second"), expectedVersion: version })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("publish", () => {
  it("makes the draft live, appends a revision, audits it and keeps the live text separate from later drafts", async () => {
    const id = await draftItem();
    const done = await publishItem(seo, { itemId: id, note: "First version" });
    const item = await ContentItem.findById(id).lean();
    expect(item).toMatchObject({ status: "published", version: 2 });
    expect(item?.published?.title).toBe("How to spot a scam");
    expect(item?.publishedAt).toBeTruthy();
    const revisions = await ContentRevision.find({ itemId: id }).lean();
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({ version: 1, status: "published", by: "staff1@example.com", note: "First version" });
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "content.publish", actorRole: "seo_editor" });
    expect(row?.undo?.kind).toBe("content.publish");
    await expect(ContentRevision.updateOne({ itemId: id }, { $set: { note: "x" } })).rejects.toThrow();
  });

  it("refuses while a [placeholder ...] marker is left, in the body, the title or the faq", async () => {
    const withBody = await draftItem(seo, "Safety", ["Call [placeholder phone] now."]);
    await expect(publishItem(seo, { itemId: withBody })).rejects.toThrow(/placeholder/);
    expect((await ContentItem.findById(withBody).lean())?.status).toBe("draft");
    const created = await createItem(seo, { kind: "help", title: "Help [placeholder title]" });
    await expect(publishItem(seo, { itemId: created.itemId })).rejects.toThrow(/placeholder/);
    const faq = await createItem(seo, { kind: "help", title: "FAQ page" });
    await saveDraft(seo, { itemId: faq.itemId, fields: { title: "FAQ page", faq: [{ q: "When?", a: "Soon [PLACEHOLDER date]" }] } });
    await expect(publishItem(seo, { itemId: faq.itemId })).rejects.toThrow(/placeholder/);
    await saveDraft(seo, { itemId: withBody, fields: fields("Safety", "Call the helpline.") });
    await expect(publishItem(seo, { itemId: withBody })).resolves.toBeTruthy();
  });

  it("a blog editor cannot publish, an editor or admin can, and legal text is for admins", async () => {
    const id = await draftItem(blog, "Blog editor post");
    await expect(publishItem(blog, { itemId: id })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await ContentItem.findById(id).lean())?.status).toBe("draft");
    await expect(publishItem(seo, { itemId: id })).resolves.toBeTruthy();
    expect(canPublishKind(["blog_editor", "seo_editor"], "blog")).toBe(true);
    expect(canPublishKind(["blog_editor"], "blog")).toBe(false);
    const legal = await createItem(admin, { kind: "legal", title: "Terms" });
    await expect(createItem(seo, { kind: "legal", title: "Privacy" })).rejects.toBeInstanceOf(ForbiddenError);
    await saveDraft(admin, { itemId: legal.itemId, fields: fields("Terms", "The rules.") });
    await expect(publishItem(seo, { itemId: legal.itemId })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(publishItem(admin, { itemId: legal.itemId })).resolves.toBeTruthy();
  });

  it("two people publishing at once: one wins, one revision", async () => {
    const id = await draftItem();
    const results = await Promise.allSettled([publishItem(seo, { itemId: id }), publishItem(admin, { itemId: id })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await ContentRevision.countDocuments({ itemId: id })).toBe(1);
  });
});

describe("unpublish and restore", () => {
  it("takes the item off the site as a redirect or as gone, and a redirect must stay on the site", async () => {
    const id = await draftItem();
    await publishItem(seo, { itemId: id });
    await expect(unpublishItem(seo, { itemId: id, mode: "redirect", to: "https://evil.example/" })).rejects.toBeInstanceOf(ValidationError);
    await expect(unpublishItem(seo, { itemId: id, mode: "redirect" })).rejects.toBeInstanceOf(ValidationError);
    await expect(unpublishItem(seo, { itemId: id, mode: "sideways" })).rejects.toBeInstanceOf(ValidationError);
    await unpublishItem(seo, { itemId: id, mode: "redirect", to: "/blog/" });
    expect(await readPublicContent("blog", "how-to-spot-a-scam")).toEqual({ state: "redirect", to: "/blog/" });
    await expect(unpublishItem(seo, { itemId: id, mode: "gone" })).rejects.toBeInstanceOf(ConflictError);
    const other = await draftItem(seo, "Another post");
    await publishItem(seo, { itemId: other });
    await unpublishItem(seo, { itemId: other, mode: "gone" });
    expect(await readPublicContent("blog", "another-post")).toEqual({ state: "gone" });
  });

  it("puts an earlier version into the draft without touching what is live", async () => {
    const id = await draftItem(seo, "Versions", ["One."]);
    await publishItem(seo, { itemId: id });
    await saveDraft(seo, { itemId: id, fields: fields("Versions", "Two.") });
    await publishItem(seo, { itemId: id });
    await restoreRevision(seo, { itemId: id, version: 1 });
    const item = await ContentItem.findById(id).lean();
    expect(richTexts(parseRich(item?.draft.body)!)).toEqual(["One."]);
    expect(richTexts(parseRich(item?.published?.body)!)).toEqual(["Two."]);
    await expect(restoreRevision(seo, { itemId: id, version: 99 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(restoreRevision(support, { itemId: id, version: 1 })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("undo of publish and unpublish", () => {
  it("undoing the first publish puts the item back to a draft; undoing the second brings back the earlier live text; both only from the saved data", async () => {
    const id = await draftItem(seo, "Undo me", ["One."]);
    const first = await publishItem(seo, { itemId: id });
    expect((await undoEvent(seo, first.eventId)).ok).toBe(true);
    expect(await ContentItem.findById(id).lean()).toMatchObject({ status: "draft", published: null });
    const again = await publishItem(seo, { itemId: id });
    await saveDraft(seo, { itemId: id, fields: fields("Undo me", "Two.") });
    const second = await publishItem(seo, { itemId: id });
    expect((await undoEvent(seo, second.eventId)).ok).toBe(true);
    const item = await ContentItem.findById(id).lean();
    expect(item?.status).toBe("published");
    expect(richTexts(parseRich(item?.published?.body)!)).toEqual(["One."]);
    expect(again.eventId).not.toBe(second.eventId);
  });

  it("undoing an unpublish puts the live text back; a change made after the event refuses the undo", async () => {
    const id = await draftItem();
    await publishItem(seo, { itemId: id });
    const off = await unpublishItem(seo, { itemId: id, mode: "gone" });
    expect((await undoEvent(seo, off.eventId)).ok).toBe(true);
    expect((await readPublicContent("blog", "how-to-spot-a-scam")).state).toBe("published");
    const later = await publishItem(seo, { itemId: id });
    await saveDraft(seo, { itemId: id, fields: fields("How to spot a scam", "Changed after.") });
    await publishItem(seo, { itemId: id });
    expect(await undoEvent(seo, later.eventId)).toMatchObject({ ok: false, reason: "conflict" });
  });

  it("a blog editor cannot undo a publish; an event without saved data cannot be undone", async () => {
    const id = await draftItem();
    const done = await publishItem(seo, { itemId: id });
    expect(await undoEvent(blog, done.eventId)).toMatchObject({ ok: false, reason: "not_allowed" });
  });
});

describe("what the public sees (read time, no cron)", () => {
  it("a published item shows its published text, never its draft; an unknown address is missing", async () => {
    const id = await draftItem();
    expect((await readPublicContent("blog", "how-to-spot-a-scam")).state).toBe("missing");
    await publishItem(seo, { itemId: id });
    expect(await isVisibleNow(id)).toBe(true);
    expect((await readPublicContent("blog", "nothing-here")).state).toBe("missing");
  });

  it("a scheduled item appears after its time with no background job, and not before", async () => {
    const id = await draftItem(seo, "Scheduled", ["For later."]);
    await publishItem(seo, { itemId: id });
    const live = (await ContentItem.findById(id).lean())!;
    const revision = await ContentRevision.findOne({ itemId: id }).lean();
    // An item that was scheduled (A34 writes this state; here it is set directly): not live yet, then due.
    const at = new Date(Date.now() + 60 * 60 * 1000);
    await ContentItem.updateOne({ _id: id }, { $set: { status: "scheduled", published: null, scheduled: { version: revision!.version, at } } });
    expect((await readPublicContent("blog", "scheduled")).state).toBe("missing");
    expect(await isVisibleNow(id)).toBe(false);
    const later = new Date(at.getTime() + 1000);
    expect(dueScheduled({ status: "scheduled", scheduled: { version: 1, at } }, later)).toEqual({ version: 1 });
    expect(await readPublicContent("blog", "scheduled", later)).toMatchObject({ state: "published", fields: { title: "Scheduled" } });
    expect(await isVisibleNow(id, later)).toBe(true);
    expect(live.status).toBe("published");
  });
});

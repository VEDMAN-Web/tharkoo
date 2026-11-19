import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/shared/policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/shared/policy")>()),
  textDenied: (text: string) => ({ denied: /blockedword/i.test(text) }),
}));

import type { AdminCtx } from "@/server/admin/context";
import { AI_DRAFT_DAILY_LIMIT, AI_DRAFT_DEFAULT_MODEL, AI_DRAFT_KEY_MISSING, SYSTEM_PROMPT, cleanText, createAiDraft, parseModelAnswer, toFields } from "@/server/content/studio/ai-draft";
import { placeholderIn } from "@/server/content/studio/fields";
import { publishItem } from "@/server/content/studio/service";
import { ConflictError, ForbiddenError, RateLimitedError, ValidationError } from "@/server/http";
import { AuditEvent } from "@/server/models";
import { ContentItem } from "@/server/models/content";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ctxOf = (roles: string[], n: number): AdminCtx => ({ actorId: `00000000000000000000009${n}`, email: `staff${n}@example.com`, roles, requestId: `req-${n}` });
const blog = ctxOf(["blog_editor"], 1);
const support = ctxOf(["support"], 2);
const admin = ctxOf(["admin"], 3);

const EM = String.fromCharCode(0x2014);

function answer(overrides: Record<string, unknown> = {}) {
  return {
    title: "A local guide to buying a used bike",
    metaDescription: "What to check before you buy a used bike near you.",
    excerpt: "A short, honest checklist for buying a used bike.",
    sections: [
      { heading: "Check the papers", paragraphs: ["Ask for the registration and the service book.", `The usual price is [ADD FACT] ${EM} ask around.`], bullets: ["Registration", "Service book"] },
      { heading: "Take a test ride", paragraphs: ["Listen for odd noises."] },
    ],
    faq: [{ q: "Is a test ride allowed?", a: "Most sellers allow one." }],
    ...overrides,
  };
}

function okFetch(body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text: typeof body === "string" ? body : JSON.stringify(body) }] }), { status: 200, headers: { "content-type": "application/json" } }));
}

const saved = { key: process.env.ANTHROPIC_API_KEY, model: process.env.AI_DRAFT_MODEL };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
  await ContentItem.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  delete process.env.AI_DRAFT_MODEL;
});
afterEach(() => {
  if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = saved.key;
  if (saved.model === undefined) delete process.env.AI_DRAFT_MODEL;
  else process.env.AI_DRAFT_MODEL = saved.model;
});

describe("H16.3 AI draft", () => {
  it("without the key it says so and makes no call", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetcher = okFetch(answer());
    await expect(createAiDraft(blog, { topic: "Buying a used bike" }, { fetcher })).rejects.toThrow(AI_DRAFT_KEY_MISSING);
    expect(AI_DRAFT_KEY_MISSING).toBe("AI drafts need ANTHROPIC_API_KEY on the server");
    expect(fetcher).not.toHaveBeenCalled();
    expect(await ContentItem.countDocuments()).toBe(0);
  });

  it("needs content.write, a topic and clean input", async () => {
    const fetcher = okFetch(answer());
    await expect(createAiDraft(support, { topic: "Buying a used bike" }, { fetcher })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createAiDraft(blog, { topic: "x" }, { fetcher })).rejects.toBeInstanceOf(ValidationError);
    await expect(createAiDraft(blog, { topic: "A blockedword topic" }, { fetcher })).rejects.toBeInstanceOf(ValidationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("asks the API with the rules, saves a draft only, marks it, and audits it", async () => {
    process.env.AI_DRAFT_MODEL = "model-from-env";
    const fetcher = okFetch(answer());
    const done = await createAiDraft(blog, { topic: "Buying a used bike", city: "Surat", keywords: "second hand" }, { fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key-not-real");
    const request = JSON.parse(String(init.body)) as { model: string; system: string; messages: { content: string }[] };
    expect(request.model).toBe("model-from-env");
    for (const rule of ["[ADD FACT]", "adult", "competitor", "Do not invent"]) expect(request.system).toContain(rule);
    expect(request.messages[0].content).toContain("Topic: Buying a used bike");
    expect(request.messages[0].content).toContain("City: Surat");

    const item = await ContentItem.findById(done.itemId).lean();
    expect(item).toMatchObject({ kind: "blog", status: "draft", aiDraft: true, version: 1, published: null });
    expect(item?.draft.title).toBe("A local guide to buying a used bike");
    expect(item?.draft.seo?.description).toBe("What to check before you buy a used bike near you.");
    expect(item?.draft.faq).toHaveLength(1);
    const nodes = (item?.draft.body as { nodes: { t: string }[] }).nodes;
    expect(nodes.filter((node) => node.t === "h2")).toHaveLength(2);
    expect(JSON.stringify(item)).not.toContain("test-key-not-real");

    const audit = await AuditEvent.findOne({ action: "content.ai_draft" }).lean();
    expect(audit).toMatchObject({ actorRole: "blog_editor", targetType: "content" });
    expect(audit?.summary).toContain("AI draft");
    expect(JSON.stringify(audit)).not.toContain("test-key-not-real");
  });

  it("uses a sensible default model when none is set", async () => {
    const fetcher = okFetch(answer());
    await createAiDraft(blog, { topic: "Buying a used bike" }, { fetcher });
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect((JSON.parse(String(init.body)) as { model: string }).model).toBe(AI_DRAFT_DEFAULT_MODEL);
    expect(AI_DRAFT_DEFAULT_MODEL).toBe("claude-sonnet-5-5");
  });

  it("cleans the text: no dashes, no markup, no links, and [ADD FACT] stays", () => {
    expect(cleanText(`Cheap ${EM} fast <b>bold</b> **x** [a link](https://example.com) [ADD FACT]`, 500)).toBe("Cheap, fast bold x a link [ADD FACT]");
    const fields = toFields(parseModelAnswer(`Here you go: ${JSON.stringify(answer({ title: `Title ${EM} with dash` }))} done`));
    expect(JSON.stringify(fields)).not.toContain(EM);
    expect(fields.title).toBe("Title, with dash");
  });

  it("a draft with an [ADD FACT] marker cannot be published until it is replaced", async () => {
    const done = await createAiDraft(admin, { topic: "Buying a used bike" }, { fetcher: okFetch(answer()) });
    const item = await ContentItem.findById(done.itemId).lean();
    expect(placeholderIn(item!.draft)).toBe(true);
    await expect(publishItem(admin, { itemId: done.itemId })).rejects.toThrow(/ADD FACT/);
  });

  it("publishing clears the AI banner flag", async () => {
    const clean = answer({ sections: [{ heading: "Check the papers", paragraphs: ["Ask for the registration."] }] });
    const done = await createAiDraft(admin, { topic: "Buying a used bike" }, { fetcher: okFetch(clean) });
    await publishItem(admin, { itemId: done.itemId });
    expect((await ContentItem.findById(done.itemId).lean())?.aiDraft).toBe(false);
  });

  it("saves nothing when the answer has a blocked word, and records the refusal", async () => {
    const bad = answer({ sections: [{ heading: "Check", paragraphs: ["A blockedword sentence."] }] });
    await expect(createAiDraft(blog, { topic: "Buying a used bike" }, { fetcher: okFetch(bad) })).rejects.toBeInstanceOf(ValidationError);
    expect(await ContentItem.countDocuments()).toBe(0);
    expect(await AuditEvent.countDocuments({ action: "content.ai_draft.failed" })).toBe(1);
  });

  it("an API failure or an unreadable answer saves nothing, says so plainly, and does not show the API text", async () => {
    const failing = vi.fn(async () => new Response("secret upstream detail", { status: 500 }));
    await expect(createAiDraft(blog, { topic: "Buying a used bike" }, { fetcher: failing })).rejects.toBeInstanceOf(ConflictError);
    await expect(createAiDraft(blog, { topic: "Buying a used bike" }, { fetcher: okFetch("not json at all") })).rejects.toThrow(/Nothing was saved/);
    expect(await ContentItem.countDocuments()).toBe(0);
    const rows = await AuditEvent.find({ action: "content.ai_draft.failed" }).lean();
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain("secret upstream detail");
  });

  it("allows 20 a day per staff member (failed tries count) and the next one is refused without a call", async () => {
    const ok = okFetch(answer({ sections: [{ heading: "Check", paragraphs: ["Fine."] }] }));
    for (let i = 0; i < AI_DRAFT_DAILY_LIMIT; i += 1) await createAiDraft(blog, { topic: `Topic number ${i}` }, { fetcher: ok });
    const refused = vi.fn();
    await expect(createAiDraft(blog, { topic: "One more topic" }, { fetcher: refused as unknown as typeof fetch })).rejects.toBeInstanceOf(RateLimitedError);
    expect(refused).not.toHaveBeenCalled();
    await createAiDraft(admin, { topic: "Another person can still ask" }, { fetcher: ok });
    expect(await ContentItem.countDocuments()).toBe(AI_DRAFT_DAILY_LIMIT + 1);
  });

  it("the system prompt holds the rules", () => {
    expect(SYSTEM_PROMPT).toMatch(/\[ADD FACT\]/);
    expect(SYSTEM_PROMPT).toMatch(/sexual wording/);
    expect(SYSTEM_PROMPT).toMatch(/competitor/);
  });
});

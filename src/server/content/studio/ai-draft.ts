import mongoose from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite, recordAdminChange } from "@/server/admin/write";
import { DASH_CHARS } from "@/server/content/dashes";
import { ConflictError, ForbiddenError, RateLimitedError, ValidationError } from "@/server/http";
import { AuditEvent, ContentItem } from "@/server/models";
import type { ContentFields } from "@/server/models/content";
import { textDenied } from "@/server/shared/policy";
import { toSlug } from "@/server/shared/slug";
import { checkFields, fieldTexts } from "./fields";

/**
 * H16.3: "AI draft" in the blog editor. A staff member gives a topic; the server asks the Anthropic API for a first draft and saves it
 * as a DRAFT blog post (never published, never sent for review). The key is read from the environment by name only and is never
 * printed or stored. Nothing here makes a network call unless the key is set, and the call is a plain `fetch` that tests replace.
 */

export const AI_DRAFT_KEY_NAME = "ANTHROPIC_API_KEY";
export const AI_DRAFT_MODEL_NAME = "AI_DRAFT_MODEL";
export const AI_DRAFT_DEFAULT_MODEL = "claude-sonnet-5-5";
export const AI_DRAFT_KEY_MISSING = "AI drafts need ANTHROPIC_API_KEY on the server";
export const AI_DRAFT_BANNER = "AI draft - check every fact before publishing";
/** How many AI drafts one staff member may ask for in 24 hours (failed tries count too, they cost money). */
export const AI_DRAFT_DAILY_LIMIT = 20;

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MAX_TOKENS = 4096;
const TIMEOUT_MS = 90_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIONS = ["content.ai_draft", "content.ai_draft.failed"];

export type AiDraftInput = { topic: string; city?: string; category?: string; keywords?: string };
export type AiDraftDeps = { fetcher?: typeof fetch };

export const SYSTEM_PROMPT = [
  "You write a first draft of a helpful local guide for Tharkoo, a classifieds website in India.",
  "Write in clear, friendly English for people in India, in the style of a useful local guide.",
  "Do not invent statistics, prices, addresses, phone numbers, opening hours, dates or names of real businesses or people. Wherever a real fact is needed, write [ADD FACT] and let a person fill it in.",
  "Do not use any adult or sexual wording, hints or topics, and nothing about paying for company or for meetings.",
  "Never name another classifieds or competitor website or app.",
  "Use plain text only: no markdown, no HTML, no links and no dashes as punctuation (use commas, colons and full stops).",
  "Structure: a title, a meta description of at most 155 characters, a one-sentence excerpt, 4 to 6 sections (each with a heading and 1 to 3 short paragraphs, and optionally a short list of bullet points) and 3 to 5 FAQ questions with short answers.",
  'Reply with ONLY one JSON object and nothing else, in exactly this shape: {"title":"","metaDescription":"","excerpt":"","sections":[{"heading":"","paragraphs":[""],"bullets":[""]}],"faq":[{"q":"","a":""}]}',
].join("\n");

const modelSchema = z.object({
  title: z.string().min(1),
  metaDescription: z.string().optional().default(""),
  excerpt: z.string().optional().default(""),
  sections: z.array(z.object({ heading: z.string().min(1), paragraphs: z.array(z.string()).default([]), bullets: z.array(z.string()).optional() })).min(1).max(12),
  faq: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).optional().default([]),
});
type ModelDraft = z.infer<typeof modelSchema>;

export function aiDraftKey(): string {
  return (process.env[AI_DRAFT_KEY_NAME] ?? "").trim();
}

export function aiDraftModel(): string {
  return (process.env[AI_DRAFT_MODEL_NAME] ?? "").trim() || AI_DRAFT_DEFAULT_MODEL;
}

export function aiDraftConfigured(): boolean {
  return aiDraftKey() !== "";
}

const DASH_RUN = new RegExp(`\\s*${DASH_CHARS.source}\\s*`, "g");

/** Plain text only: tags, links, markdown marks and dashes are removed, white space is tidied. */
export function cleanText(value: string, max: number): string {
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\[([^\]\n]*)\]\([^)\s]*\)/g, "$1")
    .replace(/[*`_#]{1,}/g, "")
    .replace(DASH_RUN, ", ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).trim() : text;
}

function userPrompt(input: AiDraftInput): string {
  const lines = [`Topic: ${input.topic}`];
  if (input.city) lines.push(`City: ${input.city}`);
  if (input.category) lines.push(`Category on the site: ${input.category}`);
  if (input.keywords) lines.push(`Keywords to use naturally: ${input.keywords}`);
  lines.push("Write the draft now.");
  return lines.join("\n");
}

function clean(value: unknown, max: number): string {
  return cleanText(typeof value === "string" ? value : "", max);
}

/** The model's JSON turned into stored fields. Everything is cleaned and cut to the limits of the editor. */
export function toFields(draft: ModelDraft): ContentFields {
  const nodes: { t: "h2" | "p" | "ul"; text?: string; items?: string[] }[] = [];
  for (const section of draft.sections) {
    const heading = clean(section.heading, 300);
    if (!heading) continue;
    nodes.push({ t: "h2", text: heading });
    for (const paragraph of section.paragraphs) {
      const text = clean(paragraph, 5000);
      if (text) nodes.push({ t: "p", text });
    }
    const items = (section.bullets ?? []).map((item) => clean(item, 500)).filter(Boolean).slice(0, 12);
    if (items.length) nodes.push({ t: "ul", items });
  }
  const faq = draft.faq.map((item) => ({ q: clean(item.q, 300), a: clean(item.a, 2000) })).filter((item) => item.q && item.a).slice(0, 8);
  const meta = clean(draft.metaDescription, 320);
  const excerpt = clean(draft.excerpt, 400);
  return {
    title: clean(draft.title, 200) || "Untitled draft",
    ...(excerpt ? { excerpt } : {}),
    body: { v: 1, nodes: nodes.slice(0, 280) } as ContentFields["body"],
    ...(faq.length ? { faq } : {}),
    ...(meta ? { seo: { description: meta } } : {}),
  };
}

/** Reads the first JSON object in the model's answer. */
export function parseModelAnswer(text: string): ModelDraft {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ValidationError("The answer was not a draft");
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ValidationError("The answer was not a draft");
  }
  const parsed = modelSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("The answer was not a draft");
  return parsed.data;
}

function checkInput(input: AiDraftInput): Required<Pick<AiDraftInput, "topic">> & AiDraftInput {
  const topic = clean(input.topic, 200);
  const city = clean(input.city, 80);
  const category = clean(input.category, 80);
  const keywords = clean(input.keywords, 200);
  if (topic.length < 3) throw new ValidationError("Write a topic of at least 3 characters.", { topic: ["Write a topic of at least 3 characters."] });
  for (const value of [topic, city, category, keywords]) {
    if (value && textDenied(value).denied) throw new ValidationError("This text is not allowed on Tharkoo");
  }
  return { topic, ...(city ? { city } : {}), ...(category ? { category } : {}), ...(keywords ? { keywords } : {}) };
}

async function usedToday(ctx: AdminCtx): Promise<number> {
  await connectDb();
  return AuditEvent.countDocuments({ actorId: ctx.actorId, action: { $in: ACTIONS }, createdAt: { $gte: new Date(Date.now() - DAY_MS) } });
}

async function askModel(input: AiDraftInput, fetcher: typeof fetch): Promise<string> {
  const response = await fetcher(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": aiDraftKey(), "anthropic-version": API_VERSION },
    body: JSON.stringify({ model: aiDraftModel(), max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userPrompt(input) }] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`the AI service answered ${response.status}`);
  const data = (await response.json()) as { content?: { type?: string; text?: string }[] };
  const text = (data.content ?? []).filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
  if (!text) throw new Error("the AI service sent no text");
  return text;
}

async function freeSlug(base: string): Promise<string> {
  const root = toSlug(base).slice(0, 80) || "ai-draft";
  const taken = new Set((await ContentItem.find({ kind: "blog", slug: { $regex: `^${root}(-[0-9]+)?$` } }).select("slug").lean<{ slug: string }[]>()).map((row) => row.slug));
  if (!taken.has(root)) return root;
  for (let n = 2; n < 200; n += 1) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
  return `${root}-${Date.now()}`;
}

/**
 * Writes one AI draft as a new blog post in "draft" status. Checks, in this order: the role, the topic, the key, the daily limit.
 * The text passes the same word, dash and length checks as any save before it is stored; if it fails them nothing is stored.
 */
export async function createAiDraft(ctx: AdminCtx, rawInput: AiDraftInput, deps: AiDraftDeps = {}): Promise<{ itemId: string; title: string; eventId: string; summary: string }> {
  await connectDb();
  if (!can(ctx.roles, "content.write")) throw new ForbiddenError("You do not have permission to do this");
  const input = checkInput(rawInput);
  if (!aiDraftConfigured()) throw new ConflictError(AI_DRAFT_KEY_MISSING);
  if ((await usedToday(ctx)) >= AI_DRAFT_DAILY_LIMIT) throw new RateLimitedError(`You can ask for ${AI_DRAFT_DAILY_LIMIT} AI drafts a day. Try again tomorrow.`);

  let fields: ContentFields;
  try {
    const answer = await askModel(input, deps.fetcher ?? fetch);
    fields = toFields(parseModelAnswer(answer));
  } catch (error) {
    const reason = error instanceof Error && !(error instanceof ValidationError) ? error.message.slice(0, 120) : "the answer could not be read";
    await recordAdminChange(ctx, { action: "content.ai_draft.failed", target: { type: "content", id: "ai-draft", label: input.topic }, after: { topic: input.topic }, summary: `AI draft for "${input.topic}" failed: ${reason}` });
    throw new ConflictError("The AI draft could not be written right now. Nothing was saved. Try again in a minute.");
  }

  let checked: ContentFields;
  try {
    checked = checkFields(fields);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    await recordAdminChange(ctx, { action: "content.ai_draft.failed", target: { type: "content", id: "ai-draft", label: input.topic }, after: { topic: input.topic }, summary: `AI draft for "${input.topic}" was refused: it had wording this site does not allow` });
    throw new ValidationError("The draft had wording this site does not allow, so nothing was saved. Try another topic or other words.");
  }

  const slug = await freeSlug(checked.title);
  const model = aiDraftModel();
  const written = await adminWrite(ctx, {
    perm: "content.write",
    action: "content.ai_draft",
    target: { type: "content", id: slug, label: checked.title },
    texts: fieldTexts(checked),
    before: async () => null,
    apply: async () => {
      const doc = await ContentItem.create({ kind: "blog", slug, draft: checked, published: null, version: 1, status: "draft", aiDraft: true, lastEditedBy: ctx.email, authorUserId: new mongoose.Types.ObjectId(ctx.actorId) });
      return { after: { kind: "blog", slug, title: checked.title, model, topic: input.topic, aiDraft: true }, result: String(doc._id), summary: `Wrote an AI draft "${checked.title}" on "${input.topic}"` };
    },
  });
  return { itemId: written.result, title: checked.title, eventId: written.eventId, summary: `AI draft "${checked.title}" is saved as a draft` };
}

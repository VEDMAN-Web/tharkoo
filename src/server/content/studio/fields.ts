import mongoose from "mongoose";
import { z } from "zod";
import { inlinePlain } from "@/lib/content/inline";
import { parseRich, richBodySchema, richTexts } from "@/lib/content/rich";
import { DASH_CHARS, DASH_MESSAGE } from "@/server/content/dashes";
import { ValidationError } from "@/server/http";
import type { ContentFields } from "@/server/models/content";
import { textDenied } from "@/server/shared/policy";

/**
 * H8.28: what a content item may contain. `checkFields` turns what an editor sent into stored fields, or says what is wrong.
 * It refuses blocked words and dashes in any visible text, and `placeholderIn` finds the "[placeholder" marker that blocks publishing.
 */

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Pick one from the list");
const optionalText = (max: number) => z.string().max(max).optional();

export const fieldsSchema = z
  .object({
    title: z.string().trim().min(1, "Write a title").max(200),
    h1: optionalText(200),
    excerpt: optionalText(400),
    body: richBodySchema.optional(),
    faq: z.array(z.object({ q: z.string().min(1).max(300), a: z.string().min(1).max(2000) }).strict()).max(40).optional(),
    seo: z
      .object({ title: optionalText(120), description: optionalText(320), canonical: optionalText(500), noindex: z.boolean().optional(), imageMediaId: objectId.optional() })
      .strict()
      .optional(),
    coverMediaId: objectId.optional(),
    authorId: objectId.optional(),
    categoryId: objectId.optional(),
    tags: z.array(z.string().min(1).max(40)).max(10).optional(),
    helpSection: optionalText(80),
    order: z.number().int().min(0).max(100_000).optional(),
    related: z.object({ posts: z.array(objectId).max(12).optional(), paths: z.array(z.string().regex(/^\/[a-z0-9\-/]{0,200}$/i)).max(12).optional() }).strict().optional(),
  })
  .strict();

export type FieldsInput = z.input<typeof fieldsSchema>;

/** Every visible piece of text of the fields, marks removed. */
export function fieldTexts(fields: Pick<ContentFields, "title" | "h1" | "excerpt" | "body" | "faq" | "seo">): string[] {
  const out = [fields.title, fields.h1, fields.excerpt, fields.seo?.title, fields.seo?.description].filter((value): value is string => typeof value === "string" && value !== "");
  for (const item of fields.faq ?? []) out.push(item.q, inlinePlain(item.a));
  const body = parseRich(fields.body);
  if (body) out.push(...richTexts(body));
  return out;
}

/** True when any text still holds a "[placeholder" or "[ADD FACT" marker (the AI draft leaves the second one). An item with it cannot be published. */
export function placeholderIn(fields: Pick<ContentFields, "title" | "h1" | "excerpt" | "body" | "faq" | "seo">): boolean {
  return fieldTexts(fields).some((value) => /\[(placeholder|add fact)/i.test(value));
}

function toId(value: unknown): mongoose.Types.ObjectId | undefined {
  return typeof value === "string" && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : value instanceof mongoose.Types.ObjectId ? value : undefined;
}

/** Stored form: id strings become ObjectIds, empty optional values are left out. Accepts ids that already are ObjectIds or strings. */
export function toStored(fields: z.output<typeof fieldsSchema>): ContentFields {
  const out: ContentFields = { title: fields.title };
  if (fields.h1) out.h1 = fields.h1;
  if (fields.excerpt) out.excerpt = fields.excerpt;
  if (fields.body) out.body = fields.body;
  if (fields.faq?.length) out.faq = fields.faq;
  if (fields.seo) {
    const { imageMediaId, ...rest } = fields.seo;
    out.seo = { ...rest, ...(imageMediaId ? { imageMediaId: toId(imageMediaId) } : {}) };
  }
  if (fields.coverMediaId) out.coverMediaId = toId(fields.coverMediaId);
  if (fields.authorId) out.authorId = toId(fields.authorId);
  if (fields.categoryId) out.categoryId = toId(fields.categoryId);
  if (fields.tags?.length) out.tags = fields.tags;
  if (fields.helpSection) out.helpSection = fields.helpSection;
  if (typeof fields.order === "number") out.order = fields.order;
  if (fields.related) out.related = { ...(fields.related.posts?.length ? { posts: fields.related.posts.map((id) => toId(id) as mongoose.Types.ObjectId) } : {}), ...(fields.related.paths?.length ? { paths: fields.related.paths } : {}) };
  return out;
}

/** Plain JSON for an audit row or an undo record: ObjectIds become strings. */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

/** The same fields back from plain JSON (an undo record or a revision read as JSON): id strings become ObjectIds again. */
export function reviveFields(value: unknown): ContentFields {
  const parsed = fieldsSchema.safeParse(value);
  if (!parsed.success) throw new ValidationError("The saved text can no longer be read");
  return toStored(parsed.data);
}

/** Checks what an editor sent. Throws a ValidationError that names the field, with plain words. */
export function checkFields(input: unknown): ContentFields {
  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "fields";
      (errors[key] ??= []).push(issue.message);
    }
    throw new ValidationError("Check the highlighted fields", errors);
  }
  const stored = toStored(parsed.data);
  const texts = fieldTexts(stored);
  if (texts.some((value) => DASH_CHARS.test(value))) throw new ValidationError("Check the highlighted fields", { text: [DASH_MESSAGE] });
  if (texts.some((value) => textDenied(value).denied)) throw new ValidationError("This text is not allowed on Tharkoo");
  return stored;
}

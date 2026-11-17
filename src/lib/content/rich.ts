import { z } from "zod";
import { inlinePlain } from "./inline";

/**
 * H8.28: the rich text of the content studio. A body is data, never HTML: `{ v: 1, nodes }` with at most 300 nodes. The editor
 * writes it, `RichBody` draws it, and nothing here can carry a script, a style or an attribute.
 */

export const MAX_NODES = 300;
const TEXT_MAX = 5000;
const ITEM_MAX = 500;
const LIST_MAX = 60;
const FAQ_MAX = 40;

const text = z.string().max(TEXT_MAX);
const mediaId = z.string().regex(/^[a-f0-9]{24}$/i, "Pick a picture from the library");

export const richNodeSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("p"), text }).strict(),
  z.object({ t: z.literal("quote"), text }).strict(),
  z.object({ t: z.literal("h2"), text: z.string().max(300) }).strict(),
  z.object({ t: z.literal("h3"), text: z.string().max(300) }).strict(),
  z.object({ t: z.literal("ul"), items: z.array(z.string().max(ITEM_MAX)).max(LIST_MAX) }).strict(),
  z.object({ t: z.literal("ol"), items: z.array(z.string().max(ITEM_MAX)).max(LIST_MAX) }).strict(),
  z.object({ t: z.literal("img"), mediaId, alt: z.string().min(1, "Describe the picture").max(125), caption: z.string().max(300).optional() }).strict(),
  z.object({ t: z.literal("faq"), items: z.array(z.object({ q: z.string().min(1).max(300), a: z.string().min(1).max(2000) }).strict()).max(FAQ_MAX) }).strict(),
  z.object({ t: z.literal("ads"), path: z.string().regex(/^\/[a-z0-9\-/]{0,200}$/i, "An ads card points to a page on this site"), label: z.string().max(120).optional() }).strict(),
]);

export const richBodySchema = z.object({ v: z.literal(1), nodes: z.array(richNodeSchema).max(MAX_NODES) }).strict();

export type RichNode = z.infer<typeof richNodeSchema>;
export type RichBody = z.infer<typeof richBodySchema>;

export const emptyRich = (): RichBody => ({ v: 1, nodes: [] });

/** The body if it is valid rich text, otherwise null. Never throws, so a bad stored value shows as empty instead of breaking a page. */
export function parseRich(value: unknown): RichBody | null {
  const parsed = richBodySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Every piece of text in the body, marks removed, in reading order. Used for word checks, dash checks and the placeholder rule. */
export function richTexts(body: RichBody): string[] {
  const out: string[] = [];
  for (const node of body.nodes) {
    if (node.t === "p" || node.t === "quote" || node.t === "h2" || node.t === "h3") out.push(inlinePlain(node.text));
    else if (node.t === "ul" || node.t === "ol") out.push(...node.items.map(inlinePlain));
    else if (node.t === "img") out.push(node.alt, ...(node.caption ? [node.caption] : []));
    else if (node.t === "faq") for (const item of node.items) out.push(item.q, inlinePlain(item.a));
    else if (node.t === "ads" && node.label) out.push(node.label);
  }
  return out;
}

/** The picture ids a body uses, so "where used" can find them. */
export function richMediaIds(body: RichBody): string[] {
  return body.nodes.flatMap((node) => (node.t === "img" ? [node.mediaId] : []));
}

/** A rough word count of the body, for the editor and for a "too short" hint. */
export function richWordCount(body: RichBody): number {
  return richTexts(body).join(" ").split(/\s+/).filter(Boolean).length;
}

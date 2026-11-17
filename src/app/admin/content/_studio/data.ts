import { parseRich, type RichNode } from "@/lib/content/rich";

/** H8.31: the editor's form state and how it becomes the fields the server saves. Plain data only, so the page and the browser share it. */

export type KeyedNode = { key: string; node: RichNode };

export type EditorState = {
  title: string;
  excerpt: string;
  body: KeyedNode[];
  seoTitle: string;
  seoDescription: string;
  noindex: boolean;
  coverMediaId: string;
  authorId: string;
  categoryId: string;
  helpSection: string;
};

export const TITLE_MAX = 90;
export const EXCERPT_MAX = 200;
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

let counter = 0;
export const nextKey = () => `n${++counter}`;

export const keyed = (nodes: readonly RichNode[]): KeyedNode[] => nodes.map((node) => ({ key: nextKey(), node }));

type Plain = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** The form state of a stored draft. Anything the form does not edit stays in the stored draft (see `buildFields`). */
export function toEditorState(fields: Plain): EditorState {
  const seo = (fields.seo ?? {}) as Plain;
  return {
    title: text(fields.title),
    excerpt: text(fields.excerpt),
    body: keyed(parseRich(fields.body)?.nodes ?? []),
    seoTitle: text(seo.title),
    seoDescription: text(seo.description),
    noindex: seo.noindex === true,
    coverMediaId: text(fields.coverMediaId),
    authorId: text(fields.authorId),
    categoryId: text(fields.categoryId),
    helpSection: text(fields.helpSection),
  };
}

/** Leaves out empty blocks (no words, no picture, no page) and empty list lines, so a half-filled block never blocks a save. */
export function cleanNodes(nodes: readonly RichNode[]): RichNode[] {
  const out: RichNode[] = [];
  for (const node of nodes) {
    if (node.t === "p" || node.t === "quote" || node.t === "h2" || node.t === "h3") {
      if (node.text.trim()) out.push({ ...node, text: node.text.trim() });
    } else if (node.t === "ul" || node.t === "ol") {
      const items = node.items.map((item) => item.trim()).filter(Boolean);
      if (items.length) out.push({ ...node, items });
    } else if (node.t === "img") {
      if (node.mediaId) out.push(node);
    } else if (node.t === "faq") {
      const items = node.items.filter((item) => item.q.trim() && item.a.trim());
      if (items.length) out.push({ ...node, items });
    } else if (node.path.trim().length > 1) out.push(node);
  }
  return out;
}

/**
 * The fields to save: the stored draft with the edited parts replaced. Empty optional values are left out.
 * Parts the form does not show (the page heading, questions, tags, order, related pages, the canonical address) are kept as they were.
 */
export function buildFields(original: Plain, state: EditorState): Plain {
  const out: Plain = { ...original, title: state.title.trim(), body: { v: 1, nodes: cleanNodes(state.body.map((item) => item.node)) } };
  const set = (key: string, value: string) => {
    if (value.trim()) out[key] = value.trim();
    else delete out[key];
  };
  set("excerpt", state.excerpt);
  set("coverMediaId", state.coverMediaId);
  set("authorId", state.authorId);
  set("categoryId", state.categoryId);
  set("helpSection", state.helpSection);
  const seo: Plain = { ...((original.seo ?? {}) as Plain) };
  if (state.seoTitle.trim()) seo.title = state.seoTitle.trim();
  else delete seo.title;
  if (state.seoDescription.trim()) seo.description = state.seoDescription.trim();
  else delete seo.description;
  if (state.noindex) seo.noindex = true;
  else delete seo.noindex;
  if (Object.keys(seo).length) out.seo = seo;
  else delete out.seo;
  return out;
}

/** The article text as written (links kept), for the link suggestions: they must know which pages are already linked. */
export function bodyText(body: readonly KeyedNode[]): string {
  const lines: string[] = [];
  for (const { node } of body) {
    if (node.t === "p" || node.t === "quote" || node.t === "h2" || node.t === "h3") lines.push(node.text);
    else if (node.t === "ul" || node.t === "ol") lines.push(...node.items);
    else if (node.t === "faq") for (const item of node.items) lines.push(item.q, item.a);
  }
  return lines.join("\n");
}

/** True when two states would save the same fields. */
export function sameState(a: EditorState, b: EditorState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

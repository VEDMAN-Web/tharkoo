import type { RichNode } from "@/lib/content/rich";

/** H8.31: small pure helpers of the editor: inline marks around a selection, and adding a suggested link into the text. */

export type Edited = { value: string; start: number; end: number };

/** Puts ** or * around the selected words. With nothing selected it puts the marks around a hint the writer replaces. */
export function wrapMark(value: string, start: number, end: number, mark: "**" | "*", hint = "text"): Edited {
  const chosen = value.slice(start, end) || hint;
  const next = `${value.slice(0, start)}${mark}${chosen}${mark}${value.slice(end)}`;
  return { value: next, start: start + mark.length, end: start + mark.length + chosen.length };
}

/** Turns the selected words into a link. The address is checked by the server when the text is saved. */
export function wrapLink(value: string, start: number, end: number, href: string, hint = "link text"): Edited {
  const chosen = value.slice(start, end) || hint;
  const next = `${value.slice(0, start)}[${chosen}](${href})${value.slice(end)}`;
  return { value: next, start: start + 1, end: start + 1 + chosen.length };
}

function linkSpans(text: string): [number, number][] {
  return [...text.matchAll(/\[[^\]\n]*\]\([^)\s]*\)/g)].map((match) => [match.index ?? 0, (match.index ?? 0) + match[0].length]);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Links the first free occurrence of the phrase in a text (not inside a link already). Returns null when there is none. */
export function linkInText(text: string, phrase: string, href: string): string | null {
  const spans = linkSpans(text);
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(phrase)})(?![\\p{L}\\p{N}])`, "giu");
  for (const match of text.matchAll(pattern)) {
    const at = (match.index ?? 0) + match[1].length;
    if (spans.some(([from, to]) => at >= from && at < to)) continue;
    return `${text.slice(0, at)}[${match[2]}](${href})${text.slice(at + match[2].length)}`;
  }
  return null;
}

/** Adds the link in the first paragraph, quote or list item that has the phrase. Returns the new nodes, or null when the phrase is not found. */
export function linkInBody(nodes: readonly RichNode[], phrase: string, href: string): RichNode[] | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.t === "p" || node.t === "quote") {
      const next = linkInText(node.text, phrase, href);
      if (next !== null) return nodes.map((item, at) => (at === index ? { ...node, text: next } : item));
    } else if (node.t === "ul" || node.t === "ol") {
      for (let at = 0; at < node.items.length; at += 1) {
        const next = linkInText(node.items[at], phrase, href);
        if (next !== null) return nodes.map((item, place) => (place === index ? { ...node, items: node.items.map((entry, i) => (i === at ? next : entry)) } : item));
      }
    }
  }
  return null;
}

import { safeHref } from "@/lib/sanitize";

/**
 * H8.28: the only inline marks the content studio allows inside a paragraph, a heading, a list item or a quote:
 * **bold**, *italic* and [label](href). Anything else is plain text, and text is never treated as HTML: the renderer
 * puts these tokens into React text nodes. A link goes through `safeHref`; a link that is not safe becomes its label.
 */

export type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "link"; text: string; href: string; external: boolean };

const PATTERN = /\*\*([^*\n]{1,500}?)\*\*|\*([^*\n]{1,500}?)\*|\[([^\]\n]{1,300})\]\(([^)\s]{1,2048})\)/g;

export function parseInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  const push = (text: string) => {
    if (text) tokens.push({ type: "text", text });
  };
  for (const match of input.matchAll(PATTERN)) {
    const at = match.index ?? 0;
    push(input.slice(last, at));
    if (match[1] !== undefined) tokens.push({ type: "bold", text: match[1] });
    else if (match[2] !== undefined) tokens.push({ type: "italic", text: match[2] });
    else {
      const href = safeHref(match[4]);
      if (href) tokens.push({ type: "link", text: match[3], href, external: !href.startsWith("/") });
      else push(match[3]);
    }
    last = at + match[0].length;
  }
  push(input.slice(last));
  return tokens;
}

/** The text with the marks removed: what a search box, a length check or a word check should look at. */
export function inlinePlain(input: string): string {
  return parseInline(input)
    .map((token) => token.text)
    .join("");
}

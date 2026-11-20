/**
 * H17.14: reads the small markdown the approved legal texts use. A block is a paragraph, a heading (a line that is all bold),
 * a bullet list, a numbered list or one table. Inline: **bold** only. Nothing here can produce HTML, so the page draws the nodes itself.
 */

export type Inline = { text: string; strong: boolean };

export type LegalNode =
  | { kind: "h2"; id: string; text: string }
  | { kind: "p"; parts: Inline[] }
  | { kind: "ul" | "ol"; items: Inline[][] }
  | { kind: "table"; head: Inline[][]; rows: Inline[][][] };

const BOLD_LINE = /^\*\*([^*\n]+)\*\*$/;
const BULLET = /^- (.*)$/;
const NUMBERED = /^\d+\. (.*)$/;

export function inlineParts(text: string): Inline[] {
  return text
    .split("**")
    .map((part, index) => ({ text: part, strong: index % 2 === 1 }))
    .filter((part) => part.text !== "");
}

export function headingId(text: string): string {
  return `s-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48)}`;
}

function cells(line: string): string[] {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function listItems(lines: string[], pattern: RegExp): string[] | null {
  const items: string[] = [];
  for (const line of lines) {
    const match = pattern.exec(line);
    if (!match) return null;
    items.push(match[1] ?? "");
  }
  return items;
}

function nodeOf(block: string): LegalNode {
  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.every((line) => line.startsWith("|")) && lines.length >= 2) {
    const [head = "", , ...body] = lines;
    return { kind: "table", head: cells(head).map(inlineParts), rows: body.map((row) => cells(row).map(inlineParts)) };
  }
  const bullets = listItems(lines, BULLET);
  if (bullets) return { kind: "ul", items: bullets.map(inlineParts) };
  const numbered = listItems(lines, NUMBERED);
  if (numbered) return { kind: "ol", items: numbered.map(inlineParts) };
  const heading = lines.length === 1 ? BOLD_LINE.exec(lines[0] ?? "") : null;
  if (heading?.[1]) return { kind: "h2", id: headingId(heading[1]), text: heading[1] };
  return { kind: "p", parts: inlineParts(lines.join(" ")) };
}

/** The blocks of one legal text (a blank-line block each) as nodes. */
export function legalNodes(blocks: string[]): LegalNode[] {
  return blocks.map(nodeOf);
}

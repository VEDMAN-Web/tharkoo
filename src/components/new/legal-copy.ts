export type LegalSection = { id: string; heading?: string; paragraphs: string[] };

const PLACEHOLDER_MARK = "[placeholder";
const HEADING_PREFIX = "## ";

export function hasPlaceholder(text: string): boolean {
  return text.toLowerCase().includes(PLACEHOLDER_MARK);
}

export function bodyParagraphs(body: string | null | undefined): string[] {
  if (!body) return [];
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function publicParagraphs(paragraphs: string[], page: string): string[] {
  return paragraphs.filter((paragraph) => {
    if (!hasPlaceholder(paragraph)) return true;
    console.warn(`[legal-copy] hidden paragraph on "${page}": the text still has a [placeholder. Fix it in admin.`);
    return false;
  });
}

function slugify(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug ? `s-${slug}` : `s-${index}`;
}

export function toSections(paragraphs: string[], page: string, headings: Record<number, string> = {}): LegalSection[] {
  const sections: LegalSection[] = [];
  let current: LegalSection = { id: "intro", paragraphs: [] };
  const startSection = (heading: string) => {
    if (current.paragraphs.length) sections.push(current);
    current = { id: slugify(heading, sections.length), heading, paragraphs: [] };
  };
  paragraphs.forEach((raw, index) => {
    if (hasPlaceholder(raw)) {
      console.warn(`[legal-copy] hidden paragraph on "${page}": the text still has a [placeholder. Fix it in admin.`);
      return;
    }
    if (raw.startsWith(HEADING_PREFIX)) {
      startSection(raw.slice(HEADING_PREFIX.length).trim());
      return;
    }
    if (headings[index]) startSection(headings[index]);
    current.paragraphs.push(raw);
  });
  if (current.paragraphs.length) sections.push(current);
  return sections;
}

export function readingMinutes(paragraphs: string[]): number {
  const words = paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

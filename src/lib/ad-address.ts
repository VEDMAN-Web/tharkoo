import { toSlug } from "@/server/shared/slug";

/** H16.2: every ad has one short code, set once. The public address is /<category>/<city>/<title-slug>-<code>/. */
const CODE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
export const AD_CODE_LENGTH = 5;
export const AD_TITLE_SLUG_MAX = 60;
const CODE_RE = /^(?=[a-z0-9]*\d)[a-z0-9]{5}$/;
const SEGMENT_RE = /^(.+)-([a-z0-9]{5})$/;

function webRandom(max: number): number {
  return Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * max);
}

/** Random 5-character base36 code (lowercase) with at least one digit. `rand(max)` returns 0..max-1. */
export function generateAdCode(rand: (max: number) => number = webRandom): string {
  const chars: string[] = [];
  for (let i = 0; i < AD_CODE_LENGTH; i += 1) chars.push(CODE_ALPHABET[rand(CODE_ALPHABET.length)]);
  if (!chars.some((c) => c >= "0" && c <= "9")) chars[rand(AD_CODE_LENGTH)] = CODE_ALPHABET[rand(10)];
  return chars.join("");
}

export function isAdCode(text: string): boolean {
  return CODE_RE.test(text);
}

/** The last address part split into the title slug and the code, or null when it does not end in a code. */
export function splitAdSegment(segment: string): { titleSlug: string; code: string } | null {
  const match = SEGMENT_RE.exec(segment);
  if (!match || !isAdCode(match[2])) return null;
  return { titleSlug: match[1], code: match[2] };
}

export function adSegment(title: string, code: string): string {
  return `${toSlug(title, AD_TITLE_SLUG_MAX)}-${code}`;
}

/** The one public address of an ad. */
export function adAddress(ad: { categorySlug: string; citySlug: string; title: string; code: string }): string {
  return `/${ad.categorySlug}/${ad.citySlug}/${adSegment(ad.title, ad.code)}/`;
}

export type AdRoute = { kind: "area" } | { kind: "ad"; titleSlug: string; code: string } | { kind: "other" };

/**
 * Reads the last part of /<category>/<city>/<x>/. A known area of that city always wins, so areas such as "sector-29"
 * (or an area whose slug happens to end like a code) keep working. Otherwise "...-<code>" is an ad address.
 */
export function parseAdRoute(x: string, districtSlugs: ReadonlySet<string>): AdRoute {
  if (districtSlugs.has(x)) return { kind: "area" };
  const parts = splitAdSegment(x);
  return parts ? { kind: "ad", ...parts } : { kind: "other" };
}

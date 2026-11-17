const SHORT_MAX = 2;
const CONSONANT_RUN = 6;
const REPEAT = 4;

/** The title patterns of the "maybe junk" guess. Plain sources, so Mongo and the page use the very same rules. */
export const JUNK_PATTERN_SOURCES: readonly string[] = [
  `^\\s*.{0,${SHORT_MAX}}\\s*$`,
  `[bcdfghjklmnpqrstvwxyz]{${CONSONANT_RUN},}`,
  `(.)\\1{${REPEAT - 1},}`,
  "^[0-9 .,!?_-]+$",
];

const PATTERNS = JUNK_PATTERN_SOURCES.map((source) => new RegExp(source, "i"));

/** A guess from the title alone: very short, a long run of letters with no vowel, one letter repeated, or no letters at all. It is a hint for staff, never a decision. */
export function looksLikeJunk(title: string): boolean {
  return PATTERNS.some((pattern) => pattern.test(title));
}

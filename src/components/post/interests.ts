/** H19.6: the interest limits. The same numbers as INTEREST_MAX and INTEREST_LENGTH_MAX in src/server/shared/fields.ts (a test keeps them equal). */
export const INTEREST_MAX = 5;
export const INTEREST_LENGTH_MAX = 30;

/** The interests after one more word: trimmed, no repeat (any case), nothing past the limit. Returns a copy of the same list when nothing changes. */
export function addInterest(list: readonly string[], raw: string): string[] {
  const word = raw.trim().replace(/\s+/g, " ").slice(0, INTEREST_LENGTH_MAX);
  if (!word || list.length >= INTEREST_MAX) return [...list];
  if (list.some((item) => item.toLowerCase() === word.toLowerCase())) return [...list];
  return [...list, word];
}
export const INTEREST_KEY = "interests";

const NAMED = /^(interests?|tags|popular[-_ ]?tags)$/i;
/** The most quick-add chips offered under Interests. */
export const POPULAR_MAX = 6;

type FieldLike = { key?: unknown; type?: unknown; options?: unknown };

/**
 * H21.12c: the "Popular:" suggestions, only from the category's own data: the options of its interests (or tags) field; without any,
 * the options of its pick-many fields. Nothing in the data means an empty list, and the row is not shown.
 */
export function popularInterestsOf(fields: readonly FieldLike[]): string[] {
  const optionsOf = (list: readonly FieldLike[]) =>
    list.flatMap((field) => (Array.isArray(field.options) ? field.options : [])).filter((option): option is string => typeof option === "string");
  const named = optionsOf(fields.filter((field) => typeof field.key === "string" && NAMED.test(field.key)));
  const source = named.length ? named : optionsOf(fields.filter((field) => field.type === "multiselect"));
  const out: string[] = [];
  for (const option of source) {
    const word = option.trim();
    if (word && word.length <= INTEREST_LENGTH_MAX && !out.some((other) => other.toLowerCase() === word.toLowerCase())) out.push(word);
    if (out.length === POPULAR_MAX) break;
  }
  return out;
}

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

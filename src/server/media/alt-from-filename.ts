/** Alt text is 3 to 125 characters (same limits as the server). */
export const AUTO_ALT_MAX = 125;
export const AUTO_ALT_FALLBACK = "Image";

/**
 * Turns a file name into a starting alt text, for example "red-sofa_01.jpg" becomes "Red sofa".
 * Steps: drop the folder and the extension, drop a trailing copy number ("_01", " 2", "(3)"),
 * turn dashes and underscores into spaces, drop other punctuation, then use sentence case.
 * Falls back to "Image" when nothing usable is left. Staff review every auto alt.
 */
export function altFromFileName(fileName: string): string {
  const base = fileName
    .replace(/^.*[\x5c/]/, "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/\s*\(\d{1,3}\)\s*$/, "")
    .replace(/[\s_-]+\d{1,3}$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (base.length < 3) return AUTO_ALT_FALLBACK;
  const sentence = base.charAt(0).toUpperCase() + base.slice(1);
  if (sentence.length <= AUTO_ALT_MAX) return sentence;
  const cut = sentence.slice(0, AUTO_ALT_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 3 ? cut.slice(0, lastSpace) : cut).trim();
}

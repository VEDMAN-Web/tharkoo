/** Plain text only: tags and control characters are removed, and links are never turned into anchors. */
export function cleanSupportText(value: unknown, max: number): string {
  const raw = typeof value === "string" ? value : "";
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

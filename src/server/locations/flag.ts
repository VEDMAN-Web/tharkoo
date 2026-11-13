/** Flag emoji from a two-letter country code. Anything else gives an empty string. */
export function flagFromCode(code: string | undefined | null): string {
  const upper = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  return String.fromCodePoint(...[...upper].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

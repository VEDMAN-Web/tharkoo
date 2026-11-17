const NO_CITY = "Not set";

/** A city for display: "Not set" when empty or unknown, else words in title case ("surat" and "SURAT" read Surat). Display only; nothing is rewritten. */
export function cityLabel(city: string | null | undefined): string {
  const text = (city ?? "").trim();
  if (!text || /^(unknown|none|n\/a|-)$/i.test(text)) return NO_CITY;
  return text.toLowerCase().replace(/(^|[\s\-'])([a-z\u00c0-\u024f])/g, (_all, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`);
}

export const slugOfCity = (city: string) => city.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

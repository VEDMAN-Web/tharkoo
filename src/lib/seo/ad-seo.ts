/** H16.4: the title, the description and the robots rules of an ad page. Pure, so a test can read them. */

export const AD_TITLE_PART_MAX = 60;
export const AD_DESCRIPTION_TEXT_MAX = 150;
export const AD_DESCRIPTION_TEXT_MIN = 40;

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

function cutAtWord(text: string, max: number, ellipsis: string): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - ellipsis.length);
  const space = cut.lastIndexOf(" ");
  const body = (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, "");
  return `${body}${ellipsis}`;
}

/** "<Ad title> in <City> - <Category> | Tharkoo". The ad title is cut at a word when it is long so the whole title stays short. */
export function adPageTitle(input: { title: string; city?: string; category?: string; site?: string }): string {
  const title = cutAtWord(clean(input.title) || "Listing", AD_TITLE_PART_MAX, "...");
  const city = clean(input.city ?? "");
  const category = clean(input.category ?? "");
  const site = clean(input.site ?? "") || "Tharkoo";
  return `${title}${city ? ` in ${city}` : ""}${category ? ` - ${category}` : ""} | ${site}`;
}

/** The ad's own words, made safe for a description: tags, links, e-mail addresses and phone numbers are removed. */
export function cleanAdText(text: string): string {
  return clean(
    text
      .replace(/<[^>]*>/g, " ")
      .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, " ")
      .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " "),
  );
}

/** The first 150 or so characters of the ad's text, cut at a word. When the text is too short to say anything, the fallback is used. */
export function adDescriptionFromText(text: string | undefined | null, fallback: string): string {
  const own = cleanAdText(text ?? "");
  if (own.length < AD_DESCRIPTION_TEXT_MIN) return fallback;
  return cutAtWord(own, AD_DESCRIPTION_TEXT_MAX, "...");
}

export type AdRobots = { index: boolean; follow: true; noimageindex: boolean };

/**
 * Index a live ad that is set to be indexed (and every live sample ad); never an ended one. A people ad keeps its text in search
 * but its photos stay out of image search.
 */
export function adRobots(input: { access: "live" | "ended" | "gone" | "missing"; indexed: boolean; sample: boolean; people: boolean }): AdRobots {
  return { index: input.access === "live" && (input.indexed || input.sample), follow: true, noimageindex: input.people };
}

/** H10.4: the meta description of an ad page, 120 to 160 characters, built only from the ad's title, category and city. */

export const AD_DESCRIPTION_MIN = 120;
export const AD_DESCRIPTION_MAX = 160;

type Input = { title: string; category: string; city: string; site: string };

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

/** The title cut at a word, with an ellipsis, so the whole description fits. */
function fitTitle(title: string, room: number): string {
  if (title.length <= room) return title;
  const cut = title.slice(0, Math.max(1, room - 1));
  const space = cut.lastIndexOf(" ");
  return `${(space > 12 ? cut.slice(0, space) : cut).replace(/[\s,.;:-]+$/, "")}…`;
}

/** "Morning walk meetup in Warangal: Spa ads in Warangal on Tharkoo. See photos, chat and verify before you meet." Longer tails are added only while it is short. */
export function adMetaDescription(input: Input): string {
  const title = clean(input.title) || "Listing";
  const category = clean(input.category);
  const city = clean(input.city);
  const site = clean(input.site) || "Tharkoo";
  const where = city ? ` in ${city}` : "";
  const head = (value: string) => `${value}: ${category ? `${category} ads` : "Ads"}${where} on ${site}.`;
  const core = " See photos, chat and verify before you meet.";
  const extras = [`${category ? ` More ${category} ads` : " More ads"}${where}.`, ` Read the details and contact the advertiser.`];
  let tail = core;
  let text = `${head(title)}${tail}`;
  for (const extra of extras) {
    if (text.length >= AD_DESCRIPTION_MIN) break;
    tail += extra;
    text = `${head(title)}${tail}`;
  }
  if (text.length <= AD_DESCRIPTION_MAX) return text;
  const room = AD_DESCRIPTION_MAX - (head("").length + tail.length);
  return `${head(fitTitle(title, room))}${tail}`;
}

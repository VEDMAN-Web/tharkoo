export interface FaqItem {
  q: string;
  a: string;
}

export interface LandingCopy {
  h1: string;
  title: string;
  description: string;
  intro: string;
  faqs: FaqItem[];
}

export interface LandingInput {
  category: string;
  city?: string;
  district?: string;
  count?: number;
  site?: string;
  indexable?: boolean;
  districts?: string[];
  priceMin?: number;
  priceMax?: number;
  updated?: string;
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const OPENERS = [
  "People in {place} post {category} notices here and update them when the details change.",
  "{place} {category} ads on {site} show the city, the district, and how to get in touch.",
  "The {category} feed for {place} lists live ads, with promoted ads at the top while they run.",
];

function hash(value: string) {
  let n = 0;
  for (const char of value) n = (n * 33 + char.charCodeAt(0)) >>> 0;
  return n;
}

const EXTRAS = [
  [
    "Each card names the district when the poster added one, so you can skip areas that are too far.",
    "A basic ad stays free within the weekly limit, and paid promotion only changes the order for a set number of days.",
    "If a page is still short, the nearby city links lead to the same category where people have already posted.",
  ],
  [
    "Photos stay on the card and the ad page, and the first image is the one the poster chose as the cover.",
    "You reply through the contact method on the ad. Tharkoo does not publish a private phone number in the page markup.",
    "Use the category list when you want homes, vehicles, jobs, or local services in the same city.",
  ],
  [
    "Newer ads move up when the poster refreshes them, which is why the updated date sits under the heading.",
    "District links narrow the same category without leaving the city, and city links keep the category and change the place.",
    "Report a listing that looks misleading. Staff review reports and can take the ad down.",
  ],
];

function fitIntro(seed: string, opening: string, detail: string) {
  const extras = EXTRAS[hash(seed) % EXTRAS.length] || EXTRAS[0];
  let intro = `${opening} ${detail}`;
  for (const line of extras) {
    if (wordCount(intro) >= 80) break;
    intro = `${intro} ${line}`;
  }
  const sentences = intro.split(/(?<=\.)\s+/);
  while (wordCount(sentences.join(" ")) > 120 && sentences.length > 2) sentences.pop();
  return sentences.join(" ");
}

export function fallbackLanding(input: LandingInput): LandingCopy {
  const site = input.site || "Tharkoo";
  const place = input.district ? `${input.district}, ${input.city}` : input.city || "India";
  const h1 = input.city ? `${input.category} in ${input.district || input.city}` : `${input.category} in India`;
  const count = input.count ?? 0;
  const opener = OPENERS[hash(`${input.category}|${place}`) % OPENERS.length] || OPENERS[0];
  const introLine = opener.replaceAll("{place}", place).replaceAll("{category}", input.category.toLowerCase()).replaceAll("{site}", site);
  const description = `${h1}. ${count} live ads. Open a listing to see photos and contact the person who posted.`;
  const districts = (input.districts || []).filter(Boolean).slice(0, 3);
  const price =
    input.priceMin && input.priceMax
      ? ` Listed prices on this page run from ₹${input.priceMin} to ₹${input.priceMax}.`
      : " Prices appear on an ad only when the person who posted added one.";
  const area = districts.length ? ` Districts with ads include ${districts.join(", ")}.` : "";
  const updated = input.updated ? ` The newest ad on this page was updated on ${input.updated}.` : "";
  const opening = `${place} currently has ${count} live ${input.category.toLowerCase()} ads on ${site}. Start with the newest card if you want what changed today, then filter by district when the list is longer than you need. Promoted ads stay above the rest only for the days that were paid.`;
  const detail = `${introLine}${area}${price}${updated}`;
  const intro = input.indexable
    ? fitIntro(`${input.category}|${place}|rich`, opening, detail)
    : `${introLine} ${count} ${input.category.toLowerCase()} ads are live in ${place}.`;
  return {
    h1,
    title: `${h1} classifieds | ${site}`,
    description: description.slice(0, 160),
    intro,
    faqs: [
      {
        q: `How do I find ${input.category.toLowerCase()} ads in ${place}?`,
        a: `Open ${h1} and use the city and district links. Each card shows the title, the place, and a way to get in touch.`,
      },
      {
        q: `How do I post a ${input.category.toLowerCase()} ad in ${place}?`,
        a: `Create an account, add a photo, and submit the ${input.category.toLowerCase()} ad for ${place}. An admin reviews your ID before the first ad goes live. A basic ad is free within the weekly limit.`,
      },
      {
        q: `Which ${input.category.toLowerCase()} ads in ${place} appear first?`,
        a: `Promoted ${input.category.toLowerCase()} ads in ${place} stay at the top for the days you buy. The other ${count} live ads follow the latest refresh. A short page stays out of the index until more ads are live.`,
      },
    ],
  };
}

export function visibleHeading(templated: string, fallback: string) {
  return templated && /\bin\b/i.test(templated) ? templated : fallback;
}

export function mergeLanding(fallback: LandingCopy, override?: Partial<LandingCopy> | null): LandingCopy {
  if (!override) return fallback;
  const faqs = override.faqs?.filter((item) => item.q?.trim() && item.a?.trim());
  return {
    h1: override.h1?.trim() || fallback.h1,
    title: override.title?.trim() || fallback.title,
    description: override.description?.trim() || fallback.description,
    intro: override.intro?.trim() || fallback.intro,
    faqs: faqs?.length ? faqs : fallback.faqs,
  };
}

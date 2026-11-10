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

export function fallbackLanding(input: LandingInput): LandingCopy {
  const site = input.site || "Tharkoo";
  const place = input.district ? `${input.district}, ${input.city}` : input.city || "India";
  const h1 = input.city ? `${input.category} in ${input.district || input.city}` : `${input.category} in India`;
  const count = input.count ?? 0;
  const opener = OPENERS[hash(`${input.category}|${place}`) % OPENERS.length] || OPENERS[0];
  const intro = opener.replaceAll("{place}", place).replaceAll("{category}", input.category.toLowerCase()).replaceAll("{site}", site);
  const description = `${h1}. ${count} live ads. Open a listing to see photos and contact the person who posted.`;
  return {
    h1,
    title: `${h1} | ${site}`,
    description: description.slice(0, 160),
    intro: `${intro} ${count} ${input.category.toLowerCase()} ads are live in ${place}.`,
    faqs: [
      {
        q: `How do I find ${input.category.toLowerCase()} ads in ${place}?`,
        a: `Open ${h1} and use the city and district links. Each card shows the title, the place, and a way to get in touch.`,
      },
      {
        q: "How do I post an ad?",
        a: `Create an account, add a photo, and submit the ad. An admin reviews your ID before the first ad goes live. A basic ad is free within the weekly limit.`,
      },
      {
        q: "Which ads appear first?",
        a: "Promoted ads stay at the top for the days you buy. Everyone else is ordered by the latest refresh.",
      },
    ],
  };
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

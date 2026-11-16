import type { ListingDoc } from "@/lib/models";
import { DEFAULT_PATHS } from "@/lib/urls";
import { defaultShellConfig } from "@/server/site-links/shell-config-rules";

const categories = [
  { slug: "dating", name: "Dating", homeBlurb: "Meet people near you with a clear, honest ad." },
  { slug: "wellness", name: "Wellness", description: "Spa, massage and care services listed by local providers across India, with prices shown up front." },
  { slug: "friendship", name: "Friendship" },
  { slug: "meetups", name: "Meetups", homeBlurb: "Groups and events." },
  { slug: "jobs", name: "Jobs", homeBlurb: "Work close to home." },
];

function ad(slug: string, citySlug: string, categorySlug: string): ListingDoc {
  return { slug, title: `Ad ${slug}`, description: "A short description of the ad.", citySlug, categorySlug, photos: [], age: 28 } as unknown as ListingDoc;
}

const shell = defaultShellConfig();
shell.media.images = [
  ...shell.media.images,
  { scope: "category", slug: "dating", photo: "/placeholders/dating/01.webp", focusX: 40, focusY: 30 },
] as typeof shell.media.images;

const countries = [{ slug: "india", name: "India", states: [], cities: [] }];

const base = {
  categories,
  shell,
  paths: DEFAULT_PATHS,
  countries,
  texts: {},
};

const hero = {
  photo: "/placeholders/hero/banner.webp",
  photoAlt: "People meeting in a city",
  desktop: "Find trusted ads near you",
  searchPlaceholder: "Search",
  focusX: 40,
  focusY: 30,
};

export const HOME_FIXTURES = {
  plain: { ...base, hero, ads: [ad("a", "pune", "dating"), ad("b", "pune", "wellness"), ad("c", "pune", "dating")], categoriesCount: 4 },
  textInImagePhone: {
    ...base,
    hero: { ...hero, textInImage: true, photoPhone: "/placeholders/hero/banner-phone.webp", phoneFocusX: 55, phoneFocusY: 20, photoWidth: 2400, photoHeight: 1029 },
    ads: [ad("a", "pune", "dating"), ad("b", "surat", "wellness")],
    categoriesCount: 6,
  },
  noAds: { ...base, hero: { ...hero, photo: "", photoAlt: "" }, ads: [] as ListingDoc[], categoriesCount: 2 },
} as const;

export type HomeFixtureName = keyof typeof HOME_FIXTURES;

/**
 * Built-in page titles and descriptions (H6.10b). They are shown only when nothing is saved for a page.
 * Each text is copied from the page's generateMetadata fallback; a saved value always wins.
 * Pure data and helpers, so the admin client and the server can both use them.
 */
import { TRUST } from "@/content/trust";
import { TEMPLATE_LIMITS, type SampleVars, type TemplatePageType } from "@/lib/seo/landing";

export interface TitleText {
  title: string;
  description: string;
}

/** What one editor or list row points at: the home page, a stored template, or one exact address. */
export type PageTitleTarget =
  | { kind: "home" }
  | { kind: "template"; pageType: TemplatePageType; categorySlug: string | null }
  | { kind: "url"; path: string };

export type PageGroup = "home" | "category" | "city" | "category-city" | "district" | "subcategory" | "ad" | "country" | "static";

export const PAGE_GROUPS: { id: PageGroup; label: string }[] = [
  { id: "home", label: "Home page" },
  { id: "category", label: "Category pages" },
  { id: "city", label: "City and state pages" },
  { id: "category-city", label: "City pages, one category at a time" },
  { id: "district", label: "District pages" },
  { id: "subcategory", label: "Sub-category pages" },
  { id: "ad", label: "Ad pages" },
  { id: "country", label: "Country pages" },
  { id: "static", label: "Other pages" },
];

export interface PageTitleRow {
  id: string;
  group: PageGroup;
  groupLabel: string;
  label: string;
  /** The address people see, with {words} for the parts that change from page to page. */
  address: string;
  /** The address without the protocol, for the search preview. */
  siteLabel: string;
  /** Saved or built-in title; an empty string means the built-in copy is in the page code. */
  title: string;
  description: string;
  /** True when this row's own text is saved (not inherited or built in). */
  saved: boolean;
  /** Null when the row cannot be edited here. */
  target: PageTitleTarget | null;
  note: string;
  /** Sample values for the search preview; null when the text has no {variables}. */
  previewVars: SampleVars | null;
}

/** Category hub fallback (src/app/[category]/page.tsx). {category} is filled with the category name. */
export const CATEGORY_TITLE_DEFAULT: TitleText = {
  title: "{category} classifieds across India | Tharkoo",
  description:
    "Browse {category} on Tharkoo: listings from people across Indian cities. Filter by city and district, see photos and contact posters directly.",
};

/** Ad page title pattern (src/app/ad/[slug]/page.tsx). The ad's own title is filled in. */
export const AD_TITLE_PATTERN = "{title}, {city} {category} | {site}";

/** Fixed pages, keyed by a short id. Each text matches the page's own generateMetadata fallback. */
export const STATIC_PAGE_DEFAULTS = {
  cities: {
    title: "Cities across India: browse classifieds by city | Tharkoo",
    description: "Pick your city to browse free classifieds across India. See ads, photos and how to contact each poster.",
  },
  countries: {
    title: "All countries: browse classifieds by country | Tharkoo",
    description: "Every country and city on Tharkoo with the number of live ads. Pick a place to browse free classifieds.",
  },
  blog: {
    title: "Tharkoo Blog: tips for safe, clear classified ads | Tharkoo",
    description: "Notes from Tharkoo on using classifieds, staying safe when you meet someone, and posting a clear ad.",
  },
  help: {
    title: "Help Center: posting, accounts and contacting people | Tharkoo",
    description: "Guides for posting an ad, managing your account, and contacting someone on Tharkoo.",
  },
  contact: {
    title: "Contact Tharkoo support | Tharkoo",
    description: TRUST.contact?.description ?? "",
  },
  search: {
    title: "Search classifieds | Tharkoo",
    description: "Search Tharkoo listings by keyword, category, and city.",
  },
  login: {
    title: "Log in | Tharkoo",
    description: "Log in to your Tharkoo account to post an ad, see your listings, and manage credits.",
  },
  register: {
    title: "Create an account | Tharkoo",
    description: "Create a Tharkoo account to post a classified ad and manage it from your dashboard.",
  },
  postAd: {
    title: "Post an ad | Tharkoo",
    description: "Save a Tharkoo listing draft and submit it for review.",
  },
} as const satisfies Record<string, TitleText>;

/** Country page fallback (src/app/countries/[country]/page.tsx). */
export function countryDefault(name: string): TitleText {
  return {
    title: `${name} classifieds: browse by state and city | Tharkoo`,
    description: `Browse free classifieds across ${name}, by state and city, with the number of live ads in each place.`,
  };
}

/** Sample values for the search preview of a category template, so {variables} read as real text. */
export function sampleVarsFor(categoryName: string, siteName: string): SampleVars {
  return { category: categoryName || "Jobs", city: "Pune", district: "Central", state: "Maharashtra", count: 12, site: siteName };
}

/** The longest stored title and description for templates and URL overrides; the server refuses longer text. */
export const PAGE_TITLE_STORED_MAX = TEMPLATE_LIMITS.title;
export const PAGE_DESCRIPTION_STORED_MAX = TEMPLATE_LIMITS.description;

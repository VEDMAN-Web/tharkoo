/**
 * UI text dictionary: every short visible string on the listing pages, the home page cards and the ad card.
 * This file is client-safe (no server imports). The admin can override any key; the code keeps these defaults so a page is never blank.
 * Placeholders such as {count} are filled with `fillText`.
 */
export const TEXT_DEFAULTS = {
  // Home
  "home.card.alt": "{title} classifieds",
  // Listing pages (category, city, district, tag, search)
  "listing.crumb.home": "Tharkoo India",
  "listing.crumb.label": "Breadcrumb",
  "listing.location.select": "Select a city",
  "listing.filters.verified": "Verified",
  "listing.filters.photos": "With photos",
  "listing.count": "{count} ads",
  "listing.updated": "Updated {date}",
  "listing.empty.title": "No listings yet",
  "listing.empty.search": "Try another word, or post the first ad.",
  "listing.empty.nearby": "Try a nearby city, or be the first to post.",
  "listing.empty.first": "Be the first to post in this place.",
  "listing.empty.post": "Post the first ad",
  "listing.promo.title": "Reach more people",
  "listing.promo.text": "Promote your ad and stay at the top.",
  "listing.promo.button": "POST YOUR AD",
  "listing.more": "Show more",
  "listing.links.popular": "Popular searches",
  "listing.links.areas": "Areas",
  "listing.links.nearby": "Nearby",
  "listing.link.in": "{name} in {place}",
  "listing.hub.browseByCity": "Browse by city",
  // Ad card
  "card.fallbackTitle": "Listing",
  "card.tier.top": "Top",
  "card.tier.supertop": "SUPER Top",
  "card.tier.star": "Star",
  "card.tier.highlight": "Highlight",
  "card.tier.new": "New",
  "card.age": "{age} years",
  "card.contact.call": "Call",
  "card.contact.whatsapp": "WhatsApp",
  "card.contact.none": "No number shared",
} as const;

export type UiTextKey = keyof typeof TEXT_DEFAULTS;
export type UiTextMap = Record<string, string>;
type Vars = Record<string, string | number | undefined>;

export const TEXT_MAX = 160;

export const TEXT_GROUPS: { id: string; label: string; prefix: string }[] = [
  { id: "home", label: "Home page", prefix: "home." },
  { id: "listing", label: "Listing pages", prefix: "listing." },
  { id: "card", label: "Ad card", prefix: "card." },
];

export const TEXT_KEYS = Object.keys(TEXT_DEFAULTS) as UiTextKey[];

export function isTextKey(key: string): key is UiTextKey {
  return Object.prototype.hasOwnProperty.call(TEXT_DEFAULTS, key);
}

/** Replaces {name} placeholders; an unknown placeholder is left as written. */
export function fillText(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (vars[name] === undefined ? whole : String(vars[name])));
}

/** `t(key, vars)` for a map of overrides (or nothing for defaults only). Works on server and client. */
export function makeT(overrides?: UiTextMap | null) {
  return (key: UiTextKey, vars?: Vars) => {
    const own = overrides?.[key];
    return fillText(typeof own === "string" && own.trim() ? own : TEXT_DEFAULTS[key], vars);
  };
}

export type TextFn = ReturnType<typeof makeT>;

/** The overrides whose keys start with these prefixes, to hand to a client component. */
export function pickTexts(overrides: UiTextMap, ...prefixes: string[]): UiTextMap {
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix))));
}

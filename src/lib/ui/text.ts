/**
 * UI text dictionary: every short visible string on the listing pages, the home page cards and the ad card.
 * This file is client-safe (no server imports). The admin can override any key; the code keeps these defaults so a page is never blank.
 * Placeholders such as {count} are filled with `fillText`.
 */
export const TEXT_DEFAULTS = {
  // Home
  "home.card.alt": "{title} classifieds",
  // H7.4: the New design home page (utility strip, banner, search, sections, ad cards)
  "home.utility.online": "Sellers online now",
  "home.utility.free": "Free to post",
  "home.utility.hours": "Fresh ads, live for 72 hours",
  "home.banner.sub": "Free ads across India. Chat with sellers online and verify on a video call.",
  "home.search.keyword": "What are you looking for?",
  "home.search.city": "City",
  "home.search.category": "Category",
  "home.search.allCities": "All cities",
  "home.search.allCategories": "All categories",
  "home.search.button": "Search",
  "home.cats.eyebrow": "Browse",
  "home.cats.title": "Popular categories",
  "home.cats.all": "All categories",
  "home.ads.eyebrow": "Fresh today",
  "home.ads.title": "Latest ads in {city}",
  "home.ads.titleAll": "Latest ads",
  "home.ads.all": "See all ads",
  "home.ads.view": "View details",
  "home.ads.views": "{count} views",
  "home.ads.online": "Online",
  "home.ads.away": "Away",
  "home.ads.watermark": "tharkoo.com",
  "home.steps.eyebrow": "Simple",
  "home.steps.title": "How Tharkoo works",
  // Listing pages (category, city, district, tag, search)
  "listing.crumb.home": "Tharkoo India",
  "listing.crumb.label": "Breadcrumb",
  "listing.location.select": "Select a city",
  "listing.filters.verified": "Verified",
  "listing.filters.photos": "With photos",
  "listing.filters.video": "With video",
  "listing.filters.online": "Online now",
  "listing.filters.min": "Min",
  "listing.filters.max": "Max",
  "listing.band.keyword": "Search keyword",
  "listing.band.search": "Search",
  "listing.band.searchPlaceholder": "Search {category} in {place}",
  "listing.band.searchCategory": "Search {category}",
  "listing.band.filters": "Filters",
  "listing.band.all": "All",
  "listing.band.close": "Close filters",
  "listing.band.breadcrumb": "Breadcrumb",
  "listing.panel.title": "Search",
  "listing.panel.active": "{count} active",
  "listing.panel.filtersLabel": "Filters",
  "listing.panel.category": "Category",
  "listing.panel.state": "State",
  "listing.panel.city": "City",
  "listing.panel.area": "Area",
  "listing.panel.allStates": "All states",
  "listing.panel.allCities": "All cities",
  "listing.panel.allAreas": "All areas",
  "listing.panel.clear": "Clear all",
  "listing.panel.apply": "Search",
  "listing.panel.noFilters": "No filters for this category yet.",
  "listing.count": "{count} ads",
  "listing.updated": "Updated {date}",
  "listing.empty.title": "No listings yet",
  "listing.empty.search": "Try another word, or post the first ad.",
  "listing.empty.nearby": "Try a nearby city, or be the first to post.",
  "listing.empty.first": "Be the first to post in this place.",
  "listing.empty.post": "Post the first ad",
  "listing.promo.title": "Reach more people",
  "listing.promo.text": "Promote your ad and stay at the top.",
  "listing.promo.button": "Post your ad",
  "listing.more": "Show more",
  "listing.links.popular": "Popular searches",
  "listing.links.areas": "Areas",
  "listing.links.nearby": "Nearby",
  "listing.link.in": "{name} in {place}",
  "listing.hub.browseByCity": "Browse by city",
  "listing.hub.browseBySub": "Browse by type",
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
  // H7.8: the header's short button label (under 420 px) and the live chat (bubble, panel and guest form)
  "header.postShort": "Post ad",
  "chat.open": "Open live chat",
  "chat.close": "Close live chat",
  "chat.closePanel": "Close chat",
  "chat.backToTop": "Back to top",
  "chat.topicsLabel": "What do you need help with?",
  "chat.guest.name": "Your name",
  "chat.guest.contact": "Email or phone",
  "chat.guest.continue": "Continue",
  "chat.guest.needName": "Add your name.",
  "chat.guest.needContact": "Add an email address or a phone number.",
  "chat.guest.replyEmail": "Thanks. Support will reply to the email address you gave.",
  "chat.guest.replyPhone": "Thanks. Support will contact you on the phone number you gave.",
  "chat.composer.label": "Message",
  "chat.composer.placeholder": "Type a message",
  "chat.composer.send": "Send",
  "chat.composer.minLength": "Write at least {count} characters.",
  "chat.reply.first": "Thanks. Support answers in this chat and in your support tickets.",
  // H7.8: "How to use this section" in the seller and user panels (2 to 4 plain sentences each)
  "help.label": "How to use this section",
  "help.section.myAds": "Your ads are listed here. Use the filters to see live, in-review or ended ads. From each row you can edit, renew, promote or post again.",
  "help.section.availableNow": "Turn Available now on when you can take calls. Buyers then see Online now. After the idle hours set on the site with no activity, you show as Away: calls pause and chat still works.",
  "help.section.wallet": "Coins are earned from your ads. One coin is worth ₹100 when you withdraw. Withdraw once you reach the minimum, and see past payouts in History.",
  "help.section.support": "Raise a ticket for anything you need help with. Only Tharkoo support can close a ticket. A closed ticket can be replaced with a new one.",
  "help.section.saved": "Ads you save appear here. Save an ad from its card, and remove it from here when you no longer need it.",
  "help.section.alerts": "Save a search to get alerts for new ads that match it. Turn an alert off here at any time.",
  "help.section.notifications": "Account messages and updates appear here. Open one to read it in full.",
} as const;

export type UiTextKey = keyof typeof TEXT_DEFAULTS;
export type UiTextMap = Record<string, string>;
type Vars = Record<string, string | number | undefined>;

export const TEXT_MAX = 160;

export const TEXT_GROUPS: { id: string; label: string; prefix: string }[] = [
  { id: "home", label: "Home page", prefix: "home." },
  { id: "listing", label: "Listing pages", prefix: "listing." },
  { id: "card", label: "Ad card", prefix: "card." },
  { id: "header", label: "Header", prefix: "header." },
  { id: "chat", label: "Live chat", prefix: "chat." },
  { id: "help", label: "Help texts", prefix: "help." },
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

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
  "listing.filters.soon": "Soon",
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
  // H7.9: the ad page (contact panel, gallery, similar ads, video call and verify pop-up)
  "ad.seller.online": "Online now \u00b7 replies fast",
  "ad.seller.away": "Away right now",
  "ad.chat": "Chat online now",
  "ad.safe.title": "Stay safe",
  "ad.safe.body": "Never pay a deposit before you have seen the place. Use the video call to check first.",
  "ad.safe.otp": "Never share OTPs or card details.",
  "ad.meta.line": "{place} \u00b7 posted {date} \u00b7 {views} views \u00b7 {clicks} clicks",
  "ad.about": "About this ad",
  "ad.details": "Details",
  "ad.gallery.prev": "Previous photo",
  "ad.gallery.next": "Next photo",
  "ad.gallery.counter": "{index} / {count}",
  "ad.gallery.photo": "Photo {index} of {count}",
  "ad.gallery.show": "Show photo {index}",
  "ad.similar.title": "Similar ads near you",
  "ad.similar.all": "See all in {category}",
  "ad.bar.chat": "Chat",
  "ad.bar.videoOne": "Video call \u00b7 1 coin",
  "ad.bar.videoMany": "Video call \u00b7 {coins} coins",
  "ad.popup.close": "Close",
  "ad.popup.error": "Something went wrong. Please try again.",
  "ad.login.title": "Log in to continue",
  "ad.login.help": "Log in with a one-time code. It takes a moment and needs no password.",
  "ad.login.phone": "Mobile number",
  "ad.login.email": "Email address",
  "ad.login.usePhone": "Use mobile number instead",
  "ad.login.useEmail": "Use email instead",
  "ad.login.send": "Send me a code",
  "ad.login.phoneError": "Enter a 10-digit mobile number.",
  "ad.login.emailError": "Enter a valid email address.",
  "ad.code.title": "Enter your code",
  "ad.code.help": "We sent a 6-digit code to {contact}.",
  "ad.code.group": "6-digit code",
  "ad.code.digit": "Digit {index}",
  "ad.code.verify": "Verify and continue",
  "ad.code.change": "Change number or email",
  "ad.code.incomplete": "Enter all 6 digits of the code.",
  "ad.call.title": "Video call and verify",
  "ad.call.help": "See the place live before you go. You pay only if the call happens.",
  "ad.call.cost": "This call costs",
  "ad.call.balance": "Your balance",
  "ad.call.coinOne": "1 coin",
  "ad.call.coinMany": "{count} coins",
  "ad.call.start": "Start video call ({coins} coin)",
  "ad.call.startMany": "Start video call ({coins} coins)",
  "ad.call.signIn": "Sign in to request a live video tour.",
  "ad.call.signInLink": "Sign in",
  "ad.call.buy": "Buy coins and call",
  "ad.call.chatFirst": "Chat with {name} first (free)",
  "ad.away.title": "{name} is away right now",
  "ad.away.help": "Away right now. No coins were used.",
  "ad.away.alts": "Sellers online now with similar ads",
  "ad.away.online": "Online now \u00b7 {place}",
  "ad.buy.title": "Buy coins to start the call",
  "ad.buy.help": "You need {coins} coin for this call. Pick a pack.",
  "ad.buy.packs": "Coin packs",
  "ad.buy.coins": "coins",
  "ad.buy.pay": "Pay {amount}",
  "ad.buy.note": "The coin is held until the call ends and goes to the seller only after a real call.",
  "ad.buy.soon": "Coin purchases open soon",
  "ad.buy.pick": "Pick a coin pack first.",
  "ad.calling.title": "Calling {name}\u2026",
  "ad.calling.help": "If {name} does not join within 2 minutes, your coin comes back.",
  "ad.calling.cancel": "Cancel",
  "ad.chat.signIn": "Log in to chat with {name}.",
  "ad.seller.name": "The seller",
  "ad.safe.fine": "Tharkoo does not intervene in relationships between users and advertisers. People arrange meetings on their own.",
} as const;

export type UiTextKey = keyof typeof TEXT_DEFAULTS;
export type UiTextMap = Record<string, string>;
type Vars = Record<string, string | number | undefined>;

export const TEXT_MAX = 160;

export const TEXT_GROUPS: { id: string; label: string; prefix: string }[] = [
  { id: "home", label: "Home page", prefix: "home." },
  { id: "listing", label: "Listing pages", prefix: "listing." },
  { id: "card", label: "Ad card", prefix: "card." },
  { id: "ad", label: "Ad page", prefix: "ad." },
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

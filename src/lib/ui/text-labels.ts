import { TEXT_KEYS, type UiTextKey } from "@/lib/ui/text";

/**
 * Plain labels for the Site text screen (H8.47): a short name for every word on the site and where it appears,
 * grouped by area. A developer key is never shown as a label. This file is client-safe.
 */
export type TextArea = { id: string; label: string; where: string; prefixes: string[] };

export const TEXT_AREAS: TextArea[] = [
  { id: "home", label: "Home page", where: "The home page", prefixes: ["home."] },
  { id: "listing", label: "Listing pages", where: "The pages that list ads: a category, a city, a search", prefixes: ["listing.", "search."] },
  { id: "card", label: "Ad cards", where: "The small card that shows one ad in a list", prefixes: ["card."] },
  { id: "ad", label: "Ad page", where: "The page of one ad", prefixes: ["ad."] },
  { id: "post", label: "Post your ad", where: "The steps for posting an ad", prefixes: ["post."] },
  { id: "promote", label: "Promote an ad", where: "The box where a seller promotes an ad", prefixes: ["promote."] },
  { id: "credits", label: "Credits and payments", where: "Adding credits, checkout, receipts and credit history", prefixes: ["recharge.", "checkout.", "history.", "receipt."] },
  { id: "panel", label: "Account panel", where: "The signed-in menu and the account home", prefixes: ["panel."] },
  { id: "chat", label: "Live chat", where: "The chat box on the site", prefixes: ["chat."] },
  { id: "header", label: "Header and footer", where: "The top and the bottom of every page", prefixes: ["header.", "chrome."] },
  { id: "myads", label: "My ads", where: "The My ads page of the account", prefixes: ["myads."] },
  { id: "howitworks", label: "How it works", where: "The How it works page", prefixes: ["howitworks."] },
  { id: "help", label: "Help texts", where: "The help lines on the account pages", prefixes: ["help."] },
];

/** Where a group of words appears, by the first two parts of the key. A group without a line here uses the line of its area. */
const WHERE: Record<string, string> = {
  "home.card": "Home page, category cards",
  "home.utility": "Home page, the strip under the header",
  "home.banner": "Home page, banner",
  "home.search": "Home page, search box",
  "home.cats": "Home page, category section",
  "home.ads": "Home page, latest ads section",
  "home.steps": "Home page, how it works",
  "listing.crumb": "Listing pages, the trail at the top",
  "listing.location": "Listing pages, place line",
  "listing.filters": "Listing pages, filter column",
  "listing.band": "Listing pages, the picture band at the top",
  "listing.panel": "Listing pages, the side panel",
  "listing.count": "Listing pages, the number of ads",
  "listing.updated": "Listing pages, the updated line",
  "listing.empty": "Listing pages, when there are no ads",
  "listing.fallback": "Listing pages, when a title or text is missing",
  "listing.promo": "Listing pages, promotion boxes",
  "listing.more": "Listing pages, the show more button",
  "listing.pager": "Listing pages, page buttons at the bottom",
  "listing.feed": "Listing pages, the list of ads",
  "listing.links": "Listing pages, links to other pages",
  "listing.link": "Listing pages, links to other pages",
  "listing.hub": "Listing pages, the hub page",
  "search.keyword": "Search results, the keyword box",
  "search.count": "Search results, the number of results",
  "search.sort": "Search results, the sort box",
  "search.chip": "Search results, the chosen filters",
  "search.chips": "Search results, the chosen filters",
  "search.heading": "Search results, the heading",
  "panel.nav": "Account panel, the menu",
  "panel.coins": "Account panel, credits",
  "panel.menu": "Account panel, the menu",
  "panel.home": "Account panel, the home page",
  "panel.dash": "Account panel, the seller dashboard",
  "panel.settings": "Account panel, settings",
  "card.fallbackTitle": "Ad card, when an ad has no title",
  "card.tier": "Ad card, the promotion badge",
  "card.age": "Ad card, the age line",
  "card.contact": "Ad card, the contact buttons",
  "ad.seller": "Ad page, the seller box",
  "ad.chat": "Ad page, the chat button",
  "ad.safe": "Ad page, the safety tips",
  "ad.report": "Ad page, the report link",
  "ad.meta": "Ad page, the line under the title",
  "ad.about": "Ad page, the description heading",
  "ad.details": "Ad page, the details heading",
  "ad.gallery": "Ad page, the photo gallery",
  "ad.similar": "Ad page, similar ads",
  "ad.readMore": "Ad page, the description",
  "ad.readLess": "Ad page, the description",
  "ad.pill": "Ad page, the small badges",
  "ad.price": "Ad page, the price",
  "ad.aboutMe": "Ad page, the seller's own words",
  "ad.save": "Ad page, the save button",
  "ad.contact": "Ad page, the contact box",
  "ad.bar": "Ad page, the bar at the bottom of a phone",
  "ad.popup": "Ad page, the popup",
  "ad.login": "Ad page, the sign in step before contacting",
  "ad.code": "Ad page, the sign in code",
  "ad.call": "Ad page, the video call",
  "ad.away": "Ad page, when the seller is away",
  "ad.buy": "Ad page, buying credits to contact",
  "ad.calling": "Ad page, while a call is starting",
  "myads.cost": "My ads, the line about what posting costs",
  "howitworks.cost": "How it works, the answer about what posting costs",
  "post.idcheck": "Post your ad, the ID check step",
  "post.pay": "Post your ad, the payment step",
  "post.field": "Post your ad, the form fields",
  "post.review": "Post your ad, the review step",
  "post.contact": "Post your ad, the contact step",
  "post.consent": "Post your ad, the confirmation boxes",
  "post.preview": "Post your ad, the preview",
  "post.nav": "Post your ad, the next and back buttons",
  "post.error": "Post your ad, error messages",
  "post.banner": "Post your ad, notices at the top",
  "post.tip": "Post your ad, tips",
  "post.rail": "Post your ad, the side rail",
  "post.header": "Post your ad, the heading",
  "post.strip": "Post your ad, the strip at the top",
  "post.pick": "Post your ad, choosing a category",
  "post.tiles": "Post your ad, the category tiles",
  "post.select": "Post your ad, drop down lists",
  "post.step": "Post your ad, the step names",
  "post.group": "Post your ad, the groups of fields",
  "post.save": "Post your ad, saving a draft",
  "post.note": "Post your ad, notes",
  "post.aside": "Post your ad, the side notes",
  "post.sub": "Post your ad, the line under the heading",
  "post.money": "Post your ad, the fee line",
  "post.form": "Post your ad, the form",
  "post.promote": "Post your ad, the promotion offer",
  "post.receipt": "Post your ad, the receipt",
  "checkout.crypto": "Checkout, paying with crypto",
  "history.used": "Credits history, what credits were spent on",
  "history.status": "Credits history, the status of a payment",
  "chrome.nav": "Header, the main menu (read by screen readers)",
  "chrome.account": "Header, the account menu",
  "chrome.menu": "Header, the menu on a phone",
  "chrome.footer": "Footer",
  "chat.guest": "Live chat, before the visitor signs in",
  "chat.composer": "Live chat, the message box",
  "chat.articles": "Live chat, help articles",
};

/** Where a whole family of words appears, by the first part of the key, for families with many small groups. */
const WHERE_FIRST: Record<string, string> = {
  recharge: "Add credits, the recharge box",
  checkout: "Checkout, the payment page",
  history: "Credits history page",
  receipt: "Receipt page",
  promote: "The promote box of an ad",
  help: "Help lines on the account pages",
  header: "The header",
};

function humanize(parts: string[]): string {
  const words = parts
    .flatMap((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_-]+/))
    .map((word) => word.toLowerCase())
    .filter(Boolean);
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function areaOf(key: string): TextArea {
  return TEXT_AREAS.find((area) => area.prefixes.some((prefix) => key.startsWith(prefix))) ?? TEXT_AREAS[TEXT_AREAS.length - 1];
}

/** A plain name for one word of the site, such as "Search all states". Never the developer key. */
export function textLabel(key: string): string {
  const parts = key.split(".").slice(1);
  return humanize(parts.length ? parts : key.split("."));
}

/** Where on the site this word shows. */
export function textWhere(key: string): string {
  return WHERE[key.split(".").slice(0, 2).join(".")] ?? WHERE_FIRST[key.split(".")[0]] ?? areaOf(key).where;
}

export type TextRow = { key: UiTextKey; label: string; where: string };

/** Every key under its area, in the order of the areas. */
export function groupedTextKeys(): { area: TextArea; rows: TextRow[] }[] {
  return TEXT_AREAS.map((area) => ({
    area,
    rows: TEXT_KEYS.filter((key) => areaOf(key).id === area.id).map((key) => ({ key, label: textLabel(key), where: textWhere(key) })),
  })).filter((group) => group.rows.length > 0);
}

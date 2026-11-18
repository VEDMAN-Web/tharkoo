/** History & undo in plain words (H7.169): names for fields, values and action codes. Pure, so the screen and the server share them. */

const IST_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FIELD_WORDS: Record<string, string> = {
  name: "Name",
  title: "Title",
  slug: "Web address",
  alt: "Picture description",
  amount: "Price in credits",
  price: "Price",
  durationHours: "Lasts (hours)",
  durationDays: "Lasts (days)",
  enabled: "Shown",
  shown: "Shown",
  removed: "Removed",
  status: "Status",
  kind: "Kind",
  icon: "Icon",
  order: "Place in the list",
  homeOrder: "Place on the Home page",
  homeShow: "Shown on the Home page",
  feedHidden: "Hidden from the lists",
  roles: "Roles",
  email: "Email",
  phone: "Phone",
  displayName: "Name",
  description: "Description",
  maxPhotos: "Max photos",
  importMaxPhotos: "Max photos for staff ads and imports",
  showPrice: "Show the price",
  showContact: "Show the contact buttons",
  videoTours: "Live video tours allowed",
  videoTourEnabled: "Live video tours",
  videoTourCoins: "Video tour price (credits)",
  expiresAt: "Ends",
  startsAt: "Starts",
  createdAt: "Created",
  updatedAt: "Changed",
  value: "Text",
  windowKey: "Undo window",
  focusX: "Focus point, across",
  focusY: "Focus point, down",
  mediaId: "Picture",
  seoTitle: "Google title",
  seoDescription: "Google description",
  introHtml: "Intro text",
  noindex: "Hidden from Google",
  postingFeeCredits: "Posting fee (credits)",
  creditPriceInr: "Price of one credit",
  mockPaymentsOn: "Test payments",
  paidPostingOn: "Paid posting",
  credits: "Credits",
  bonus: "Bonus credits",
  tag: "Label",
  percent: "Percent off",
  maxRedemptions: "Most uses",
  perUserLimit: "Uses per person",
};

function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

/** "durationHours" is "Lasts (hours)"; "photo.alt" is "Photo: picture description". Unknown names are spelled out in words, never shown as code. */
export function fieldLabel(path: string): string {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return path;
  const last = FIELD_WORDS[parts[parts.length - 1]] ?? humanize(parts[parts.length - 1]);
  if (parts.length === 1) return last;
  const lead = FIELD_WORDS[parts[0]] ?? humanize(parts[0]);
  return `${lead}: ${last.charAt(0).toLowerCase()}${last.slice(1)}`;
}

/** A date and time in Indian time, the way staff say it: "19 Nov, 11:52 am". The year is added only when it is not this year. */
export function dateWords(value: Date | string, now: Date = new Date()): string {
  const shifted = new Date(new Date(value).getTime() + IST_MS);
  if (Number.isNaN(shifted.getTime())) return String(value);
  const hour = shifted.getUTCHours();
  const clock = `${hour % 12 === 0 ? 12 : hour % 12}:${String(shifted.getUTCMinutes()).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
  const year = shifted.getUTCFullYear() === new Date(now.getTime() + IST_MS).getUTCFullYear() ? "" : ` ${shifted.getUTCFullYear()}`;
  return `${shifted.getUTCDate()} ${MONTHS[shifted.getUTCMonth()]}${year}, ${clock}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const ISO_IN_TEXT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;

/** A sentence with every raw date in it written as an Indian-time date: "Extended, ends 19 Nov, 11:52 am". */
export function plainSentence(text: string, now: Date = new Date()): string {
  return text.replace(ISO_IN_TEXT, (found) => dateWords(found, now));
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** How a saved value reads to a person: Yes and No, dates in Indian time, lists as words, ids as "a record". */
export function plainValue(text: string): string {
  const value = text.trim();
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  if (value === "null" || value === "undefined") return "";
  if (ISO.test(value)) return dateWords(value);
  if (OBJECT_ID.test(value)) return "a record";
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const list = JSON.parse(value) as unknown[];
      if (list.every((item) => typeof item === "string" || typeof item === "number")) return list.map((item) => plainValue(String(item))).join(", ") || "empty";
    } catch {
      return text;
    }
  }
  return text;
}

const ACTION_WORDS: Record<string, string> = {
  "listing.contact_reveal": "A visitor showed a phone number",
  "listing.edit": "An ad was edited",
  "listing.remove": "An ad was removed",
  "listing.pause": "An ad was paused",
  "listing.resume": "An ad was resumed",
  "listing.extend": "An ad was extended",
  "listing.set_end": "An ad got a new end time",
  "listing.end_now": "An ad was ended",
  "listing.reject": "An ad was rejected",
  "listing.checked": "An ad was checked",
  "listing.boost": "An ad was boosted",
  "user.ban": "A user was banned",
  "user.unban": "A user was unbanned",
  "user.profile": "A user's details were changed",
  "user.vendor": "A vendor profile was changed",
  "user.logout_everywhere": "A user was signed out everywhere",
  "team.invite": "Someone was invited to the team",
  "team.roles": "A team member's roles were changed",
  "team.remove": "A team member lost access",
  "support.reply": "A support ticket was answered",
  "support.close": "A support ticket was closed",
  "support.open": "A support ticket was opened",
  "support.view": "A support ticket was read",
  "support.assign": "A support ticket was given to someone",
  "content.save": "A page or post was saved",
  "content.publish": "A page or post was published",
  "layout.publish": "A page layout was published",
  "media.trash": "A picture was moved to the Trash",
  "media.update": "A picture's details were changed",
  "media.restore": "A picture was taken out of the Trash",
  "plan.update": "A promotion plan was changed",
  "plan.create": "A promotion plan was added",
  "settings.money.update": "The money settings were changed",
  "settings.undo_windows": "The undo windows were changed",
  "admin.write.denied": "A change was refused: the person may not make it",
  "admin.api.denied": "A request was refused: the person may not make it",
  "auth.login_code.success": "Someone signed in with a code",
  "auth.login_code.locked": "A sign-in was locked after wrong codes",
  "verification.decision": "An ID check was decided",
  "verification.view": "An ID check was opened",
  "admin.bootstrap": "The first admin account was set up",
  "settings.id_check.default": "ID check before posting set to its default",
  "category_kind.create": "A kind was added",
  "category_kind.update": "A kind was changed",
  "category_kind.remove": "A kind was removed",
};

/** What an audit row says when no one wrote a sentence for it: a known action in words, any other as its words, never as code. */
export function actionWords(action: string): string {
  const known = ACTION_WORDS[action];
  if (known) return known;
  const words = action.split(/[._-]+/).filter(Boolean).join(" ").toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "A change";
}

/** What kind of record a change touched, in words ("an ad", "a plan"); any other as its words. */
const TARGET_WORDS: Record<string, string> = {
  listing: "An ad",
  user: "A user",
  category: "A category",
  category_kind: "A kind",
  promotion_plan: "A promotion plan",
  site_media: "A picture",
  site: "The site settings",
  support_ticket: "A support ticket",
  ui_text: "A word on the site",
  location: "A place",
  content: "A page or post",
};

export function targetWords(type: string): string {
  return TARGET_WORDS[type] ?? humanize(type);
}
